package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

const maxRequestBytes = 1 << 20

type server struct {
	distDir string
	ai      aiConfig
	client  *http.Client
}

const (
	textTimeout  = 75 * time.Second
	imageTimeout = 120 * time.Second
	mediaTimeout = 120 * time.Second
)

type aiConfig struct {
	TextBaseURL     string
	TextKey         string
	TextModel       string
	TextProtocol    string
	ImageBaseURL    string
	ImageKey        string
	ImageModel      string
	ImageProtocol   string
	MimoBaseURL     string
	MimoKey         string
	SeedanceBaseURL string
	SeedanceKey     string
	SeedanceModel   string
	SeedanceCreate  string
	SeedanceStatus  string
}

const (
	defaultTextModel      = "GPT-5.6 Sol"
	defaultImageModel     = "gpt-image-2"
	defaultSeedanceModel  = "seedance-2.0"
	defaultSeedanceCreate = "/v1/videos"
	defaultSeedanceStatus = "/v1/videos/{id}"
)

type ssoUser struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type narrativeRequest struct {
	SystemPrompt string `json:"systemPrompt"`
	UserPrompt   string `json:"userPrompt"`
}

type portraitRequest struct {
	Prompt   string `json:"prompt"`
	CacheKey string `json:"cacheKey"`
}

type speechRequest struct {
	Text     string `json:"text"`
	Speaker  string `json:"speaker"`
	Delivery string `json:"delivery"`
}

type speechRecognitionRequest struct {
	Audio string `json:"audio"`
	Mime  string `json:"mime"`
}

type seedanceRequest struct {
	Prompt string `json:"prompt"`
}

var seedanceTaskIDPattern = regexp.MustCompile(`^[A-Za-z0-9._:-]{1,200}$`)

type worldSpecRequest struct {
	Source  string `json:"source"`
	ThemeID string `json:"themeId"`
}

type reflectionInsightRequest struct {
	Source        string   `json:"source"`
	ThemeID       string   `json:"themeId"`
	ConflictFocus string   `json:"conflictFocus"`
	Actions       []string `json:"actions"`
	Evidence      []string `json:"evidence"`
}

type characterContext struct {
	ID         string   `json:"id"`
	Principles []string `json:"principles"`
	Goal       string   `json:"goal"`
	Emotion    string   `json:"emotion"`
	KnownFacts []string `json:"knownFacts"`
}

type characterProposalRequest struct {
	Turn       int                `json:"turn"`
	ActionType string             `json:"actionType"`
	TargetID   string             `json:"targetId"`
	Characters []characterContext `json:"characters"`
}

type characterProposal struct {
	NPCID      string `json:"npcId"`
	Kind       string `json:"kind"`
	Intent     string `json:"intent"`
	Reason     string `json:"reason"`
	PublicText string `json:"publicText"`
	Emphasis   string `json:"emphasis"`
}

// storyTurnRequest is the bounded context for one open-ended PGC turn. The
// model writes the performance of the next chapter, but it does not own the
// authoritative world state: the client/director validates every proposal
// before committing characters, items or locations.
type storyTurnRequest struct {
	WorldID           string               `json:"worldId"`
	Turn              int                  `json:"turn"`
	PlayerAction      string               `json:"playerAction"`
	CurrentLocation   string               `json:"currentLocation"`
	StageGoal         string               `json:"stageGoal"`
	CanonConstraints  []string             `json:"canonConstraints"`
	AllowedLocations  []string             `json:"allowedLocations"`
	Inventory         []string             `json:"inventory"`
	ItemStates        []storyItemContext   `json:"itemStates"`
	RecentEvents      []string             `json:"recentEvents"`
	LongTermSummary   []string             `json:"longTermSummary"`
	UnresolvedThreads []string             `json:"unresolvedThreads"`
	ThreadStates      []storyThreadContext `json:"threadStates"`
	Characters        []characterContext   `json:"characters"`
}

type storyItemContext struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Holder  string `json:"holder"`
	Status  string `json:"status"`
	Purpose string `json:"purpose"`
}

type storyThreadContext struct {
	ID      string `json:"id"`
	Summary string `json:"summary"`
}

type storyTurnReaction struct {
	CharacterID string `json:"characterId"`
	PublicText  string `json:"publicText"`
	Intent      string `json:"intent"`
}

type storyTurnAction struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Intent string `json:"intent"`
}

type storyTurnResponse struct {
	Title              string              `json:"title"`
	Paragraphs         []string            `json:"paragraphs"`
	CharacterReactions []storyTurnReaction `json:"characterReactions"`
	SuggestedActions   []storyTurnAction   `json:"suggestedActions"`
	ImagePrompts       []string            `json:"imagePrompts"`
	NewThread          string              `json:"newThread"`
	StateDelta         struct {
		Location    string `json:"location,omitempty"`
		ItemChanges []struct {
			ItemID  string `json:"itemId"`
			Holder  string `json:"holder,omitempty"`
			Status  string `json:"status,omitempty"`
			Purpose string `json:"purpose,omitempty"`
		} `json:"itemChanges,omitempty"`
		ResolvedThreadIDs []string `json:"resolvedThreadIds,omitempty"`
	} `json:"stateDelta,omitempty"`
}

func main() {
	port := os.Getenv("APP_PORT")
	if port == "" {
		port = "3000"
	}
	distDir := os.Getenv("APP_DIST_DIR")
	if distDir == "" {
		distDir = "dist"
	}
	s := newServer(distDir, loadAIProperties("ai.properties"))
	log.Printf("EchoForge listening on 0.0.0.0:%s", port)
	log.Fatal(http.ListenAndServe("0.0.0.0:"+port, s.routes()))
}

func newServer(distDir string, ai aiConfig) *server {
	if ai.TextModel == "" {
		ai.TextModel = defaultTextModel
	}
	if ai.ImageModel == "" {
		ai.ImageModel = defaultImageModel
	}
	if ai.TextProtocol == "" {
		ai.TextProtocol = "openai"
	}
	if ai.ImageProtocol == "" {
		ai.ImageProtocol = "openai"
	}
	if ai.SeedanceModel == "" {
		ai.SeedanceModel = defaultSeedanceModel
	}
	if !strings.HasPrefix(ai.SeedanceCreate, "/") {
		ai.SeedanceCreate = defaultSeedanceCreate
	}
	if !strings.HasPrefix(ai.SeedanceStatus, "/") || !strings.Contains(ai.SeedanceStatus, "{id}") {
		ai.SeedanceStatus = defaultSeedanceStatus
	}
	return &server{
		distDir: distDir,
		ai:      ai,
		client:  &http.Client{Timeout: mediaTimeout},
	}
}

func (s *server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "redverse"})
	})
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "redverse"})
	})
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	})
	mux.HandleFunc("GET /api/status", func(w http.ResponseWriter, _ *http.Request) {
		characterMode := "deterministic-local"
		if s.ai.TextBaseURL != "" && s.ai.TextKey != "" {
			characterMode = "parallel-per-character"
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"aiEnabled":      s.ai.TextBaseURL != "" && s.ai.TextKey != "",
			"imageEnabled":   s.ai.ImageBaseURL != "" && s.ai.ImageKey != "",
			"ttsEnabled":     s.ai.MimoBaseURL != "" && s.ai.MimoKey != "",
			"asrEnabled":     s.ai.MimoBaseURL != "" && s.ai.MimoKey != "",
			"videoEnabled":   s.ai.SeedanceBaseURL != "" && s.ai.SeedanceKey != "",
			"characterMode":  characterMode,
			"textModel":      configuredModel(s.ai.TextBaseURL, s.ai.TextKey, displayModel(s.ai.TextProtocol, s.ai.TextModel, "Bedrock-compatible text")),
			"imageModel":     configuredModel(s.ai.ImageBaseURL, s.ai.ImageKey, displayModel(s.ai.ImageProtocol, s.ai.ImageModel, "Google-compatible image")),
			"voiceModel":     configuredModel(s.ai.MimoBaseURL, s.ai.MimoKey, "mimo-v2.5-tts"),
			"speechModel":    configuredModel(s.ai.MimoBaseURL, s.ai.MimoKey, "mimo-v2.5-asr"),
			"videoModel":     configuredModel(s.ai.SeedanceBaseURL, s.ai.SeedanceKey, s.ai.SeedanceModel),
			"soundscapeMode": "browser-synth",
		})
	})
	mux.HandleFunc("GET /api/whoami", s.withUser(func(w http.ResponseWriter, _ *http.Request, user ssoUser) {
		writeJSON(w, http.StatusOK, user)
	}))
	mux.HandleFunc("POST /api/narrate", s.withUser(s.narrate))
	mux.HandleFunc("POST /api/world-spec", s.withUser(s.worldSpec))
	mux.HandleFunc("POST /api/reflection-insight", s.withUser(s.reflectionInsight))
	mux.HandleFunc("POST /api/portrait", s.withUser(s.portrait))
	mux.HandleFunc("POST /api/character-proposals", s.withUser(s.characterProposals))
	mux.HandleFunc("POST /api/story-turn", s.withUser(s.storyTurn))
	mux.HandleFunc("POST /api/tts", s.withUser(s.synthesizeSpeech))
	mux.HandleFunc("POST /api/asr", s.withUser(s.recognizeSpeech))
	mux.HandleFunc("POST /api/seedance/tasks", s.withUser(s.createSeedanceTask))
	mux.HandleFunc("GET /api/seedance/tasks/{id}", s.withUser(s.getSeedanceTask))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "api route not found"})
	})
	mux.HandleFunc("/", s.serveFrontend)
	return securityHeaders(requestLog(mux))
}

func (s *server) recognizeSpeech(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.MimoBaseURL == "" || s.ai.MimoKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "MiMo ASR is not configured"})
		return
	}
	var input speechRecognitionRequest
	if err := decodeJSONLimit(w, r, &input, 8<<20); err != nil {
		return
	}
	input.Audio = strings.TrimSpace(input.Audio)
	input.Mime = strings.ToLower(strings.TrimSpace(input.Mime))
	format := "webm"
	switch {
	case strings.Contains(input.Mime, "wav"):
		format = "wav"
	case strings.Contains(input.Mime, "mpeg"), strings.Contains(input.Mime, "mp3"):
		format = "mp3"
	case strings.Contains(input.Mime, "mp4"), strings.Contains(input.Mime, "m4a"):
		format = "mp4"
	case strings.Contains(input.Mime, "ogg"):
		format = "ogg"
	case strings.Contains(input.Mime, "webm"):
		format = "webm"
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported audio format"})
		return
	}
	if len(input.Audio) < 32 || len(input.Audio) > 7<<20 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid audio recording"})
		return
	}
	payload := map[string]any{
		"model": "mimo-v2.5-asr",
		"messages": []map[string]any{{
			"role": "user",
			"content": []map[string]any{{
				"type":        "input_audio",
				"input_audio": map[string]string{"data": input.Audio, "format": format},
			}},
		}},
	}
	data, status, err := s.callProvider(strings.TrimRight(s.ai.MimoBaseURL, "/")+"/chat/completions", "api-key", s.ai.MimoKey, payload)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(data, &result) != nil || len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "MiMo returned no transcript"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"text": strings.TrimSpace(result.Choices[0].Message.Content), "provider": "mimo-v2.5-asr"})
}

func (s *server) synthesizeSpeech(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.MimoBaseURL == "" || s.ai.MimoKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "MiMo TTS is not configured"})
		return
	}
	var input speechRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	input.Text = strings.TrimSpace(input.Text)
	input.Speaker = strings.TrimSpace(input.Speaker)
	input.Delivery = strings.TrimSpace(input.Delivery)
	voices := map[string]string{
		"narrator": "茉莉", "partner": "苏打", "witness": "冰糖", "captain": "白桦",
		"child_narrator": "茉莉", "fox": "冰糖", "bear": "苏打", "chongchong": "冰糖", "manman": "白桦", "tingting": "茉莉",
	}
	voice, ok := voices[input.Speaker]
	if !ok || len([]rune(input.Text)) == 0 || len([]rune(input.Text)) > 900 || len([]rune(input.Delivery)) > 900 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid speech request"})
		return
	}
	if input.Delivery == "" {
		input.Delivery = "自然、有画面感，按句意停顿，不要播音腔。"
	}
	characterDirection := map[string]string{
		"narrator":       "角色：温润克制、观察敏锐的电影叙事者。",
		"partner":        "角色：聪明、自尊、略带防备的青年当事人。",
		"witness":        "角色：安静、敏锐、只确认亲眼所见的年轻见证者。",
		"captain":        "角色：低沉稳重、重视边界和程序的资深裁决者。",
		"child_narrator": "角色：会蹲下来陪孩子看绘本的温暖讲述者。声音清亮柔和，不幼稚化，不训话。",
		"fox":            "角色：小学年龄的小狐狸，敏感、真诚，鼓起勇气时仍带一点迟疑。",
		"bear":           "角色：憨厚的小熊，起初没注意到别人，明白后语气认真而不夸张。",
		"chongchong":     "角色：精力充沛的小鸟冲冲，语速稍快，想到办法就忍不住往前冲。",
		"manman":         "角色：慢吞吞但可靠的乌龟慢慢，语速偏慢，每句话都像认真想过。",
		"tingting":       "角色：善于倾听的小兔听听，声音轻柔，提问时有真诚的好奇。",
	}[input.Speaker]
	payload := map[string]any{
		"model": "mimo-v2.5-tts",
		"messages": []map[string]string{
			{"role": "user", "content": characterDirection + " 场景：互动叙事中的关键转折。演绎指导：" + input.Delivery},
			{"role": "assistant", "content": input.Text},
		},
		"audio": map[string]string{"format": "wav", "voice": voice},
	}
	data, status, err := s.callProvider(strings.TrimRight(s.ai.MimoBaseURL, "/")+"/chat/completions", "api-key", s.ai.MimoKey, payload)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	var result struct {
		Choices []struct {
			Message struct {
				Audio struct {
					Data string `json:"data"`
				} `json:"audio"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(data, &result) != nil || len(result.Choices) == 0 || result.Choices[0].Message.Audio.Data == "" {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "MiMo returned no audio"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"audio": result.Choices[0].Message.Audio.Data, "mime": "audio/wav", "provider": "mimo-v2.5-tts"})
}

func (s *server) createSeedanceTask(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.SeedanceBaseURL == "" || s.ai.SeedanceKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Seedance is not configured"})
		return
	}
	var input seedanceRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	input.Prompt = strings.TrimSpace(input.Prompt)
	if len([]rune(input.Prompt)) < 12 || len([]rune(input.Prompt)) > 1800 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid video prompt"})
		return
	}
	payload := map[string]any{"model": s.ai.SeedanceModel, "prompt": input.Prompt}
	endpoint := strings.TrimRight(s.ai.SeedanceBaseURL, "/") + s.ai.SeedanceCreate
	data, status, err := s.callProvider(endpoint, "Authorization", "Bearer "+s.ai.SeedanceKey, payload)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	var raw map[string]any
	if json.Unmarshal(data, &raw) != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Seedance returned invalid JSON"})
		return
	}
	writeJSON(w, http.StatusAccepted, normalizeSeedanceTask(raw))
}

func (s *server) getSeedanceTask(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.SeedanceBaseURL == "" || s.ai.SeedanceKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Seedance is not configured"})
		return
	}
	id := strings.TrimSpace(r.PathValue("id"))
	if !seedanceTaskIDPattern.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid task id"})
		return
	}
	statusPath := strings.ReplaceAll(s.ai.SeedanceStatus, "{id}", url.PathEscape(id))
	endpoint := strings.TrimRight(s.ai.SeedanceBaseURL, "/") + statusPath
	req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, endpoint, nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "create Seedance request"})
		return
	}
	req.Header.Set("Authorization", "Bearer "+s.ai.SeedanceKey)
	resp, err := s.client.Do(req)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Seedance is unavailable"})
		return
	}
	defer resp.Body.Close()
	data, readErr := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if readErr != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Seedance task lookup failed"})
		return
	}
	var raw map[string]any
	if json.Unmarshal(data, &raw) != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "Seedance returned invalid JSON"})
		return
	}
	writeJSON(w, http.StatusOK, normalizeSeedanceTask(raw))
}

func normalizeSeedanceTask(raw map[string]any) map[string]any {
	result := map[string]any{}
	if nested, ok := raw["data"].(map[string]any); ok {
		result = nested
	} else {
		for key, value := range raw {
			result[key] = value
		}
	}
	id := stringValue(result, "id", "task_id", "taskId")
	status := strings.ToLower(stringValue(result, "status", "state"))
	switch status {
	case "success", "succeeded", "completed", "done":
		status = "succeeded"
	case "failed", "error", "cancelled", "canceled":
		status = "failed"
	case "running", "processing", "in_progress":
		status = "running"
	default:
		status = "queued"
	}
	videoURL := stringValue(result, "video_url", "videoUrl", "url")
	if content, ok := result["content"].(map[string]any); ok && videoURL == "" {
		videoURL = stringValue(content, "video_url", "videoUrl", "url")
	}
	return map[string]any{"id": id, "status": status, "videoUrl": videoURL, "error": stringValue(result, "error", "message")}
}

func stringValue(source map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := source[key].(string); ok {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func configuredModel(baseURL, key, model string) string {
	if strings.TrimSpace(baseURL) == "" || strings.TrimSpace(key) == "" {
		return ""
	}
	return model
}

func displayModel(protocol, directModel, compatibleName string) string {
	if protocol != "openai" {
		return compatibleName
	}
	return directModel
}

// callText supports explicitly configured OpenAI- and Bedrock-compatible
// endpoints. No provider URL or credential is built into the application.
func (s *server) callText(message string, maxTokens int) (string, int, error) {
	if s.ai.TextProtocol == "bedrock" {
		payload := map[string]any{
			"anthropic_version": "bedrock-2023-05-31",
			"max_tokens":        maxTokens,
			"messages":          []map[string]string{{"role": "user", "content": message}},
		}
		data, status, err := s.callProviderWithTimeout(strings.TrimRight(s.ai.TextBaseURL, "/")+"/bedrock_runtime/model/invoke", "token", s.ai.TextKey, payload, textTimeout)
		if err != nil {
			return "", status, err
		}
		var result struct {
			Code    any `json:"Code"`
			Error   any `json:"Error"`
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		}
		if json.Unmarshal(data, &result) != nil || result.Code != nil || result.Error != nil || len(result.Content) == 0 || strings.TrimSpace(result.Content[0].Text) == "" {
			return "", http.StatusBadGateway, errors.New("AI text gateway returned an invalid response")
		}
		return strings.TrimSpace(result.Content[0].Text), http.StatusBadGateway, nil
	}
	payload := map[string]any{
		"model":      s.ai.TextModel,
		"messages":   []map[string]string{{"role": "user", "content": message}},
		"max_tokens": maxTokens,
	}
	// GPT-5.6 Sol may otherwise spend the full cap on hidden reasoning and
	// return an empty visible object for schema-heavy world generation.
	if strings.EqualFold(strings.TrimSpace(s.ai.TextModel), "GPT-5.6 Sol") {
		payload["reasoning_effort"] = "low"
	}
	data, status, err := s.callProviderWithTimeout(strings.TrimRight(s.ai.TextBaseURL, "/")+"/v1/chat/completions", "Authorization", "Bearer "+s.ai.TextKey, payload, textTimeout)
	if err != nil {
		return "", status, err
	}
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error any `json:"error"`
	}
	if json.Unmarshal(data, &result) != nil || result.Error != nil || len(result.Choices) == 0 || strings.TrimSpace(result.Choices[0].Message.Content) == "" {
		log.Printf("AI text gateway invalid response: %s", truncateForLog(string(data), 1200))
		return "", http.StatusBadGateway, errors.New("AI text gateway returned an invalid response")
	}
	return strings.TrimSpace(result.Choices[0].Message.Content), http.StatusBadGateway, nil
}

func strictJSONText(text string) string {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)
	// Some otherwise valid model replies add one sentence before/after the JSON.
	// Extract only the outer object; the subsequent typed validation remains the
	// authority and rejects invented ids or malformed fields.
	if start, end := strings.Index(text, "{"), strings.LastIndex(text, "}"); start >= 0 && end > start {
		return strings.TrimSpace(text[start : end+1])
	}
	return text
}

func normalizeStoryParagraphs(paragraphs []string) []string {
	if len(paragraphs) != 1 || len([]rune(strings.TrimSpace(paragraphs[0]))) < 70 {
		return paragraphs
	}
	runes := []rune(strings.TrimSpace(paragraphs[0]))
	mid := len(runes) / 2
	cut := mid
	for offset := 0; offset < len(runes)/3; offset++ {
		for _, candidate := range []int{mid + offset, mid - offset} {
			if candidate > 20 && candidate < len(runes)-20 && strings.ContainsRune("。！？!?", runes[candidate-1]) {
				cut = candidate
				return []string{strings.TrimSpace(string(runes[:cut])), strings.TrimSpace(string(runes[cut:]))}
			}
		}
	}
	return []string{strings.TrimSpace(string(runes[:cut])), strings.TrimSpace(string(runes[cut:]))}
}

func (s *server) worldSpec(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.TextBaseURL == "" || s.ai.TextKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AI world builder is not configured"})
		return
	}
	var input worldSpecRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	input.Source = strings.TrimSpace(input.Source)
	allowedThemes := map[string]bool{"workplace": true, "relationship": true, "decision": true, "growth": true}
	if len([]rune(input.Source)) < 2 || len([]rune(input.Source)) > 2000 || !allowedThemes[input.ThemeID] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid world source"})
		return
	}
	prompt := `你是回响引擎 EchoForge 的现实回应分析师兼 World Builder。先直接回应用户的真实问题，再为这一次输入原创一个可探索的镜像世界，不能用漂亮隐喻代替分析，也不能复用默认的航海、灯塔、森林模板。

现实回应必须强绑定用户原话中的人物、事件、时间窗口、约束和利害关系：
1. situationSummary 用具体名词复述处境与两难，证明真的读懂；
2. emotionalAcknowledgement 接住情绪及其合理来源，不空泛安慰、不诊断；
3. coreConflict 分析双方可能保护的利益、权力与风险，不武断裁决动机；
4. knownFacts 只能写用户明确说过的两项；unknowns 写最影响判断的两个未知；
5. options 必须是三个逐级行动：查规则/证据、直接沟通、必要时咨询有权限的人；每项明确对象与产物；
6. firstAction 要在24小时内可做、低风险、可退出；conversationScript 给可直接复制的中文话术；escalationBoundary 说明何时升级、找谁、带什么材料。
禁止只给“写三个代价、做七天试验、保留未知”等可套用到任何问题的建议。禁止诊断、裁决、煽动冲突和高风险指令。

主题骨架为 ` + input.ThemeID + `，它只约束认知方法，不限制场景。为用户原话原创地点、线索、人物、关键物件与可执行动作：例如家庭可以是搬家档案室或记忆拍卖会，演出冲突可以是后台、排练厅与票务台，健康取舍可以是训练营、诊室与退赛窗口。不要把所有问题都写成航海或职场。三个角色原则不可被玩家改变：partner 是利益或节奏不同的当事人，witness 只说有限事实，captain 只按程序或边界行动。四个地点的 key 必须保持 deck/chart_room/crow_nest/captain_room，但名称、描述必须按本次输入原创。六条线索 key 也保持不变，但内容必须对应本次事件，并明确“能证明什么/不能证明什么”。九个对话动作必须具体到本次人物、物件或规则。禁止复用“沈亦舟、阿灯、祝舰长、灯塔城、航海勋章”等默认名字或真实姓名。

只返回严格 JSON，无 Markdown，格式：{"realWorldAnalysis":{"situationSummary":"具体处境复述","emotionalAcknowledgement":"情绪承接","coreConflict":"核心冲突分析","knownFacts":["已知1","已知2"],"unknowns":["未知1","未知2"],"options":["第一步","第二步","第三步"],"firstAction":"24小时内行动","conversationScript":"可复制话术","escalationBoundary":"升级边界"},"worldTitle":"不超过16字","metaphor":"不超过40字","openingQuestion":"不超过50字","objectiveTitle":"不超过20字","objectiveDetail":"不超过60字","conflictFocus":"不超过25字","reflectionLens":"不超过60字","reversibleAction":"不超过80字","openingNarrative":"120-180字","chapterTitles":["四个不超过15字的标题"],"lexicon":{"partnerName":"虚构名","witnessName":"虚构名","captainName":"虚构名","artifact":"关键物件","record":"独立记录","process":"公平流程或试验","outcome":"待探索结果"},"agentBriefs":{"partner":{"name":"同partnerName","principle":"不变原则","goal":"当前目标"},"witness":{"name":"同witnessName","principle":"不变原则","goal":"当前目标"},"captain":{"name":"同captainName","principle":"不变原则","goal":"当前目标"}},"locationCopy":{"deck":{"name":"原创地点","shortName":"短名","description":"用途"},"chart_room":{"name":"原创地点","shortName":"短名","description":"用途"},"crow_nest":{"name":"原创地点","shortName":"短名","description":"用途"},"captain_room":{"name":"原创地点","shortName":"短名","description":"用途"}},"clueCopy":{"clue_draft_map":{"name":"线索","meaning":"能证明与不能证明"},"clue_ink_smudge":{"name":"线索","meaning":"能证明与不能证明"},"clue_night_log":{"name":"线索","meaning":"能证明与不能证明"},"clue_witness_trust":{"name":"线索","meaning":"能证明与不能证明"},"clue_captain_doubt":{"name":"线索","meaning":"能证明与不能证明"},"clue_combined_proof":{"name":"证据链","meaning":"可推进什么"}},"actionCopy":{"observe":"具体观察动作","investigate":"具体调查动作","combine":"具体组合动作","partnerTalk":["三条具体对话"],"witnessTalk":["三条具体对话"],"captainTalk":["三条具体对话"]}}。用户原话：` + input.Source
	text, status, err := s.callText(prompt, 4200)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	var spec map[string]any
	if json.Unmarshal([]byte(strictJSONText(text)), &spec) != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid world JSON"})
		return
	}
	writeJSON(w, http.StatusOK, spec)
}

func (s *server) reflectionInsight(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.TextBaseURL == "" || s.ai.TextKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AI reflection is not configured"})
		return
	}
	var input reflectionInsightRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	input.Source = strings.TrimSpace(input.Source)
	allowedThemes := map[string]bool{"workplace": true, "relationship": true, "decision": true, "growth": true}
	if len([]rune(input.Source)) < 2 || len([]rune(input.Source)) > 2000 || !allowedThemes[input.ThemeID] || len(input.Actions) > 8 || len(input.Evidence) > 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid reflection context"})
		return
	}
	humanActions := make([]string, 0, len(input.Actions))
	for _, action := range input.Actions {
		humanActions = append(humanActions, humanizeActionKey(action))
	}
	prompt := `你是回响引擎 EchoForge 的现实处境分析师。用户刚结束一局隐喻游戏，但你的首要任务不是解释游戏，而是准确回应用户最初的现实问题。

无论用户讲的是职场、关系、学业、家庭还是陌生领域，都严格使用同一套“认知排练协议”，不要为某个案例临时改变方法：
1. 将用户明确说过的事实，与对他人动机的猜测分开；
2. 指出用户和相关方各自在保护什么，以及不可接受的代价；
3. 把表面二选一还原为真正的两难；
4. 找到最影响决定、但仍未确认的未知；
5. 给出 3 条策略，每条写清收益、代价、适用条件；
6. 形成一个 24 小时内可开始、低风险、可退出的动作，写明找谁、准备什么、怎么开口、完成信号和停止条件。

既不能过拟合，也不能泛化：acknowledgement、assessment、每条策略和 nextStep 中，至少各引用一项用户原话里的具体人物关系、目标、时间、地点、事件或约束；但不得把用户没有说过的内容补成事实。游戏记录只可作为“用户在排练中更愿意观察、核对、沟通或等待”的弱证据，不能证明现实人物的动机。禁止“做七天小实验”“多沟通”“相信自己”等可套用到任何问题的建议。不要诊断、裁决他人动机或替用户作重大决定。不得输出 talk:partner、investigate: 等内部状态键。

只返回严格 JSON，无 Markdown，格式：{"acknowledgement":"具体共情","coreTension":"真正两难","assessment":"当前判断","knownFacts":["2至4项"],"unknowns":["2至5项"],"options":[{"title":"方案名","upside":"收益","cost":"代价","bestWhen":"适用条件"},{"title":"方案名","upside":"收益","cost":"代价","bestWhen":"适用条件"},{"title":"方案名","upside":"收益","cost":"代价","bestWhen":"适用条件"}],"nextStep":{"title":"动作标题","steps":["3至5个步骤"],"script":"可直接说的话","successSignal":"完成信号","stopCondition":"停止或求助条件"}}。现实原话：` + input.Source + `\n主题：` + input.ThemeID + `；冲突标签：` + input.ConflictFocus + `；本局行动：` + strings.Join(humanActions, "、") + `；本局发现：` + strings.Join(input.Evidence, "、")
	text, status, err := s.callText(prompt, 2600)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	var insight map[string]any
	if json.Unmarshal([]byte(strictJSONText(text)), &insight) != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid reflection JSON"})
		return
	}
	writeJSON(w, http.StatusOK, insight)
}

func humanizeActionKey(action string) string {
	actionType, _, _ := strings.Cut(strings.TrimSpace(action), ":")
	switch actionType {
	case "talk":
		return "与一个相关角色核对立场"
	case "investigate":
		return "核对一条具体信息"
	case "observe":
		return "先观察可见事实"
	case "move":
		return "换到另一个信息来源"
	case "use":
		return "连接两份独立信息"
	case "wait":
		return "暂时等待局势变化"
	default:
		return "尝试了一种新的处理方式"
	}
}

func (s *server) withUser(next func(http.ResponseWriter, *http.Request, ssoUser)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := parseSSOUser(r.Header.Get("X-User-Info"))
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "user identity required"})
			return
		}
		next(w, r, user)
	}
}

func parseSSOUser(raw string) (ssoUser, error) {
	if raw == "" {
		return ssoUser{}, errors.New("missing SSO header")
	}
	var user ssoUser
	if err := json.Unmarshal([]byte(raw), &user); err != nil {
		return ssoUser{}, fmt.Errorf("decode SSO user: %w", err)
	}
	if user.UserID == "" {
		return ssoUser{}, errors.New("SSO userId is missing")
	}
	return user, nil
}

func (s *server) narrate(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.TextBaseURL == "" || s.ai.TextKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AI narration is not configured"})
		return
	}
	var input narrativeRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	input.SystemPrompt = strings.TrimSpace(input.SystemPrompt)
	input.UserPrompt = strings.TrimSpace(input.UserPrompt)
	if input.UserPrompt == "" || len(input.UserPrompt) > 20000 || len(input.SystemPrompt) > 10000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid prompt"})
		return
	}
	message := input.UserPrompt
	if input.SystemPrompt != "" {
		message = input.SystemPrompt + "\n\n" + input.UserPrompt
	}
	text, status, err := s.callText(message, 1024)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"text": text})
}

func (s *server) characterProposals(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.TextBaseURL == "" || s.ai.TextKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AI character proposals are not configured"})
		return
	}
	var input characterProposalRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	if len(input.Characters) == 0 || len(input.Characters) > 6 || len(input.ActionType) > 30 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid character context"})
		return
	}
	// Every character gets an isolated model call with only its own constitution,
	// goal, memory and the player's action. Calls run concurrently, so adding real
	// per-role agency does not turn the game loop into three sequential waits.
	type proposalResult struct {
		index    int
		proposal characterProposal
		valid    bool
	}
	results := make(chan proposalResult, len(input.Characters))
	for index, character := range input.Characters {
		go func(index int, character characterContext) {
			contextJSON, _ := json.Marshal(map[string]any{
				"turn": input.Turn, "playerAction": input.ActionType, "targetId": input.TargetID, "character": character,
			})
			prompt := `你现在只扮演一个互动世界角色，不是旁白，也不能替其他角色发言。只能依据自己的 principles、goal、emotion、knownFacts 决定此刻是否行动；不得新增事实、改变人格或迎合玩家。返回严格 JSON：{"action":{"npcId":"自己的id","kind":"review|withdraw|disclose|observe|stay","intent":"短意图","reason":"引用自己的原则、目标或已知事实","publicText":"不超过80字的可见动作","emphasis":"quiet|normal|strong"}}。如果此刻没有合乎人格且有意义的动作，返回 {"action":null}。禁止 Markdown。你的私有上下文：` + string(contextJSON)
			text, _, err := s.callText(prompt, 420)
			if err != nil {
				results <- proposalResult{index: index}
				return
			}
			var parsed struct {
				Action *characterProposal `json:"action"`
			}
			if json.Unmarshal([]byte(strictJSONText(text)), &parsed) != nil || parsed.Action == nil || parsed.Action.NPCID != character.ID {
				results <- proposalResult{index: index}
				return
			}
			results <- proposalResult{index: index, proposal: *parsed.Action, valid: true}
		}(index, character)
	}
	parsed := make([]proposalResult, 0, len(input.Characters))
	for range input.Characters {
		parsed = append(parsed, <-results)
	}
	sort.Slice(parsed, func(i, j int) bool { return parsed[i].index < parsed[j].index })
	allowedIDs := map[string]bool{}
	for _, c := range input.Characters {
		allowedIDs[c.ID] = true
	}
	allowedKinds := map[string]bool{"review": true, "withdraw": true, "disclose": true, "observe": true, "stay": true}
	approved := make([]characterProposal, 0, 2)
	seen := map[string]bool{}
	for _, result := range parsed {
		if !result.valid {
			continue
		}
		proposal := result.proposal
		proposal.NPCID = strings.TrimSpace(proposal.NPCID)
		proposal.Kind = strings.TrimSpace(proposal.Kind)
		if !allowedIDs[proposal.NPCID] || !allowedKinds[proposal.Kind] || seen[proposal.NPCID] || strings.TrimSpace(proposal.Intent) == "" || strings.TrimSpace(proposal.Reason) == "" || strings.TrimSpace(proposal.PublicText) == "" || len([]rune(proposal.PublicText)) > 180 {
			continue
		}
		seen[proposal.NPCID] = true
		approved = append(approved, proposal)
		if len(approved) == 2 {
			break
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"actions": approved, "mode": "parallel-per-character", "agentsConsulted": len(input.Characters)})
}

func (s *server) storyTurn(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.TextBaseURL == "" || s.ai.TextKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "AI story director is not configured"})
		return
	}
	var input storyTurnRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	input.PlayerAction = strings.TrimSpace(input.PlayerAction)
	if len([]rune(input.WorldID)) < 2 || len([]rune(input.WorldID)) > 80 || input.Turn < 0 || input.Turn > 80 || len([]rune(input.PlayerAction)) < 1 || len([]rune(input.PlayerAction)) > 600 || len(input.Characters) > 8 || len(input.Inventory) > 24 || len(input.ItemStates) > 24 || len(input.AllowedLocations) > 24 || len(input.RecentEvents) > 12 || len(input.LongTermSummary) > 24 || len(input.UnresolvedThreads) > 12 || len(input.ThreadStates) > 12 || len(input.CanonConstraints) > 20 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid story turn context"})
		return
	}
	allowedItems := map[string]bool{}
	for _, item := range input.ItemStates {
		item.ID = strings.TrimSpace(item.ID)
		if item.ID == "" || allowedItems[item.ID] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid story item memory"})
			return
		}
		allowedItems[item.ID] = true
	}
	allowedThreads := map[string]bool{}
	for _, thread := range input.ThreadStates {
		thread.ID = strings.TrimSpace(thread.ID)
		if thread.ID == "" || allowedThreads[thread.ID] {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid story thread memory"})
			return
		}
		allowedThreads[thread.ID] = true
	}
	allowedLocations := map[string]bool{}
	for _, location := range input.AllowedLocations {
		location = strings.TrimSpace(location)
		if location != "" {
			allowedLocations[location] = true
		}
	}
	contextJSON, _ := json.Marshal(input)
	prompt := `你是互动历史世界的 Director。先读取 canonConstraints、itemStates、threadStates、characters 和 recentEvents，再处理 playerAction。结构化记忆是权威事实。

这一回合必须让第一次玩的用户立刻看懂“我刚做了什么、产生了什么效果、谁因此改变了判断、接下来危险是什么”：
1. paragraphs[0] 只写玩家原话行动造成的即时、可感知结果，第一句就出现具体动作或对象；不得把玩家行动偷换成按钮模板；
2. paragraphs[1] 写一至两名在场人物基于有限知识、欲望与恐惧作出的具体动作或短对白；
3. 如有 paragraphs[2]，只写世界状态变化与一个迫近的新危险，不写总结、哲理或作者解释；
4. characterReactions 必须与正文一致，不能让人物无理由改变态度；
5. 三个 suggestedActions 必须分别是不同策略，title 要包含具体动词与对象，让玩家不读 intent 也知道会做什么；禁用“先观察一下”“寻找其他办法”“看看情况”等抽象按钮；
6. imagePrompts 要描写本回合发生后的新构图，包含地点、角色动作、关键物件、光线与镜头景别，不能只复述世界标题。

不得凭空增加决定性证据、人物、物件或地点，不得改变人物原则。正文180至360字，分2至3段；回收一个已有物件或伏笔，留下一个新危机。给3个真正不同的下一步和1个无文字电影镜头。使用现代、清楚的中文短句，强动作、低解释；禁用破折号、“不是……而是……”、文言堆砌与空泛哲理。stateDelta只能引用上下文已有id。只返回严格JSON：{"title":"章名","paragraphs":["段落"],"characterReactions":[{"characterId":"已有id","publicText":"动作或台词","intent":"意图"}],"suggestedActions":[{"id":"短id","title":"按钮","intent":"行动意图"}],"imagePrompts":["镜头"],"newThread":"悬念","stateDelta":{"location":"已有地点","itemChanges":[{"itemId":"已有id","holder":"持有人","status":"状态","purpose":"用途"}],"resolvedThreadIds":["已有id"]}}。上下文：` + string(contextJSON)
	// The gateway counts reasoning as well as visible JSON. A low cap can cut a
	// perfectly good object mid-string, so leave enough room while the prompt
	// still constrains visible prose to 180–360 Chinese characters.
	text, status, err := s.callText(prompt, 4000)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	var chapter storyTurnResponse
	if json.Unmarshal([]byte(strictJSONText(text)), &chapter) != nil {
		log.Printf("story-turn invalid JSON: %s", truncateForLog(text, 1200))
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid story chapter JSON"})
		return
	}
	chapter.Paragraphs = normalizeStoryParagraphs(chapter.Paragraphs)
	if len([]rune(chapter.Title)) < 2 || len([]rune(chapter.Title)) > 60 || len(chapter.Paragraphs) < 2 || len(chapter.Paragraphs) > 4 || len(chapter.SuggestedActions) < 2 || len(chapter.SuggestedActions) > 4 || len(chapter.ImagePrompts) > 2 {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid story chapter structure"})
		return
	}
	allowedCharacters := map[string]bool{}
	for _, character := range input.Characters {
		allowedCharacters[character.ID] = true
	}
	for _, reaction := range chapter.CharacterReactions {
		if !allowedCharacters[reaction.CharacterID] || strings.TrimSpace(reaction.PublicText) == "" || len([]rune(reaction.PublicText)) > 240 {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid character reaction"})
			return
		}
	}
	for _, paragraph := range chapter.Paragraphs {
		if len([]rune(strings.TrimSpace(paragraph))) < 30 || len([]rune(paragraph)) > 1000 {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid chapter paragraph"})
			return
		}
	}
	for _, action := range chapter.SuggestedActions {
		if strings.TrimSpace(action.ID) == "" || strings.TrimSpace(action.Title) == "" || strings.TrimSpace(action.Intent) == "" || len([]rune(action.Title)) > 40 {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid suggested action"})
			return
		}
	}
	for _, imagePrompt := range chapter.ImagePrompts {
		if len([]rune(strings.TrimSpace(imagePrompt))) < 10 || len([]rune(imagePrompt)) > 500 {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "invalid image prompt"})
			return
		}
	}
	// Treat the model as a narrative proposer, not the authority. An otherwise
	// useful chapter should not collapse into a generic fallback just because
	// its structured delta contains one hallucinated id. Keep the prose and
	// character response, but drop only state mutations the engine cannot prove.
	if chapter.StateDelta.Location != "" && !allowedLocations[chapter.StateDelta.Location] {
		chapter.StateDelta.Location = ""
	}
	validChanges := chapter.StateDelta.ItemChanges[:0]
	for _, change := range chapter.StateDelta.ItemChanges {
		if allowedItems[change.ItemID] {
			validChanges = append(validChanges, change)
		}
	}
	chapter.StateDelta.ItemChanges = validChanges
	validThreadIDs := chapter.StateDelta.ResolvedThreadIDs[:0]
	for _, threadID := range chapter.StateDelta.ResolvedThreadIDs {
		if allowedThreads[threadID] {
			validThreadIDs = append(validThreadIDs, threadID)
		}
	}
	chapter.StateDelta.ResolvedThreadIDs = validThreadIDs
	writeJSON(w, http.StatusOK, chapter)
}

func truncateForLog(value string, limit int) string {
	value = strings.ReplaceAll(strings.TrimSpace(value), "\n", " ")
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit]) + "…"
}

func (s *server) portrait(w http.ResponseWriter, r *http.Request, _ ssoUser) {
	if s.ai.ImageBaseURL == "" || s.ai.ImageKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "image generation is not configured"})
		return
	}
	var input portraitRequest
	if err := decodeJSON(w, r, &input); err != nil {
		return
	}
	input.Prompt = strings.TrimSpace(input.Prompt)
	if input.Prompt == "" || len(input.Prompt) > 5000 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid image prompt"})
		return
	}
	if s.ai.ImageProtocol == "google" {
		payload := map[string]any{
			"contents":         []map[string]any{{"role": "user", "parts": []map[string]string{{"text": input.Prompt}}}},
			"generationConfig": map[string]any{"responseModalities": []string{"TEXT", "IMAGE"}, "maxOutputTokens": 32768},
		}
		data, status, err := s.callProviderWithTimeout(strings.TrimRight(s.ai.ImageBaseURL, "/")+"/google/v1:generateContent", "api-key", s.ai.ImageKey, payload, imageTimeout)
		if err != nil {
			writeJSON(w, status, map[string]string{"error": err.Error()})
			return
		}
		var result struct {
			Code       any `json:"Code"`
			Error      any `json:"Error"`
			Candidates []struct {
				FinishReason string `json:"finishReason"`
				Content      struct {
					Parts []struct {
						InlineData *struct {
							MimeType string `json:"mimeType"`
							Data     string `json:"data"`
						} `json:"inlineData"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if json.Unmarshal(data, &result) != nil || result.Code != nil || result.Error != nil || len(result.Candidates) == 0 {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "image gateway returned an invalid response"})
			return
		}
		candidate := result.Candidates[0]
		if candidate.FinishReason != "" && candidate.FinishReason != "STOP" && candidate.FinishReason != "MAX_TOKENS" {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "image generation was rejected"})
			return
		}
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && part.InlineData.Data != "" {
				mimeType := part.InlineData.MimeType
				if mimeType == "" {
					mimeType = "image/png"
				}
				writeJSON(w, http.StatusOK, map[string]string{"image": "data:" + mimeType + ";base64," + part.InlineData.Data, "provider": "google-compatible-image"})
				return
			}
		}
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "image gateway returned no image"})
		return
	}
	payload := map[string]any{
		"model":   s.ai.ImageModel,
		"prompt":  input.Prompt,
		"size":    "1536x1024",
		"quality": "low",
		"n":       1,
	}
	data, status, err := s.callProviderWithTimeout(strings.TrimRight(s.ai.ImageBaseURL, "/")+"/v1/images/generations", "Authorization", "Bearer "+s.ai.ImageKey, payload, imageTimeout)
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	var result struct {
		Data []struct {
			B64JSON string `json:"b64_json"`
			URL     string `json:"url"`
		} `json:"data"`
		Error any `json:"error"`
	}
	if err := json.Unmarshal(data, &result); err != nil || result.Error != nil || len(result.Data) == 0 {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": "image gateway returned an invalid response"})
		return
	}
	if result.Data[0].B64JSON != "" {
		writeJSON(w, http.StatusOK, map[string]string{"image": "data:image/png;base64," + result.Data[0].B64JSON, "provider": s.ai.ImageModel})
		return
	}
	if strings.HasPrefix(result.Data[0].URL, "https://") {
		writeJSON(w, http.StatusOK, map[string]string{"image": result.Data[0].URL, "provider": s.ai.ImageModel})
		return
	}
	writeJSON(w, http.StatusBadGateway, map[string]string{"error": "image gateway returned no image"})
}

func (s *server) callProvider(url, keyHeader, key string, payload any) ([]byte, int, error) {
	return s.callProviderWithTimeout(url, keyHeader, key, payload, mediaTimeout)
}

func (s *server) callProviderWithTimeout(url, keyHeader, key string, payload any, timeout time.Duration) ([]byte, int, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, http.StatusInternalServerError, errors.New("encode AI request")
	}
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, http.StatusInternalServerError, errors.New("create AI request")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set(keyHeader, key)
	client := s.client
	if timeout > 0 && timeout != mediaTimeout {
		client = &http.Client{Timeout: timeout}
	}
	resp, err := client.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return nil, http.StatusGatewayTimeout, errors.New("AI gateway timed out; retry or use the local story fallback")
		}
		var netErr net.Error
		if errors.As(err, &netErr) && netErr.Timeout() {
			return nil, http.StatusGatewayTimeout, errors.New("AI gateway timed out; retry or use the local story fallback")
		}
		log.Printf("AI gateway request failed host=%s error=%v", req.URL.Host, err)
		return nil, http.StatusBadGateway, errors.New("AI gateway connection failed; check network and retry")
	}
	defer resp.Body.Close()
	// gpt-image-2 returns base64 inline; a 1536×1024 image can exceed 8 MiB
	// before JSON overhead. Keep a bounded but realistic ceiling so valid images
	// are not truncated into an opaque 502.
	data, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, http.StatusBadGateway, errors.New("read AI response")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Preserve the few statuses the UI can turn into an actionable recovery,
		// but never forward the provider body: it can contain request ids or
		// credential diagnostics. Everything else remains a generic bad gateway.
		switch resp.StatusCode {
		case http.StatusPaymentRequired:
			return nil, http.StatusPaymentRequired, errors.New("provider quota is exhausted; recharge or switch the configured plan")
		case http.StatusTooManyRequests:
			return nil, http.StatusTooManyRequests, errors.New("provider is rate limited; retry shortly")
		case http.StatusUnauthorized, http.StatusForbidden:
			return nil, http.StatusBadGateway, errors.New("provider credential or model permission is invalid")
		default:
			return nil, http.StatusBadGateway, fmt.Errorf("AI gateway returned %d", resp.StatusCode)
		}
	}
	return data, http.StatusBadGateway, nil
}

func (s *server) serveFrontend(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	cleaned := filepath.Clean("/" + r.URL.Path)
	rel := strings.TrimPrefix(cleaned, "/")
	// Runtime credentials and deployment metadata must never be downloadable,
	// even if they live beside the executable.
	if strings.HasSuffix(rel, ".properties") || strings.HasPrefix(rel, ".") {
		http.NotFound(w, r)
		return
	}
	if rel == "" {
		rel = "index.html"
	}
	path := filepath.Join(s.distDir, filepath.FromSlash(rel))
	if info, err := os.Stat(path); err != nil || info.IsDir() {
		path = filepath.Join(s.distDir, "index.html")
	}
	if ext := filepath.Ext(path); ext != "" {
		if contentType := mime.TypeByExtension(ext); contentType != "" {
			w.Header().Set("Content-Type", contentType)
		}
	}
	http.ServeFile(w, r, path)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	return decodeJSONLimit(w, r, dst, maxRequestBytes)
}

func decodeJSONLimit(w http.ResponseWriter, r *http.Request, dst any, limit int64) error {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON request"})
		return err
	}
	return nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func loadAIProperties(path string) aiConfig {
	properties := map[string]string{}
	for _, propertyPath := range []string{path, "mimo.properties", "seedance.properties"} {
		data, err := os.ReadFile(propertyPath)
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(data), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(line, "=")
			if ok {
				properties[strings.TrimSpace(key)] = strings.TrimSpace(value)
			}
		}
	}
	mimoKey := firstConfigured(os.Getenv("APP_MIMO_API_KEY"), properties["mimo.api_key"])
	mimoBaseURL := firstConfigured(os.Getenv("APP_MIMO_BASE_URL"), properties["mimo.base_url"])
	if mimoBaseURL == "" && mimoKey != "" {
		if strings.HasPrefix(mimoKey, "tp-") {
			mimoBaseURL = "https://token-plan-cn.xiaomimimo.com/v1"
		} else {
			mimoBaseURL = "https://api.xiaomimimo.com/v1"
		}
	}
	seedanceKey := firstConfigured(os.Getenv("APP_SEEDANCE_API_KEY"), properties["seedance.api_key"])
	seedanceBaseURL := firstConfigured(os.Getenv("APP_SEEDANCE_BASE_URL"), properties["seedance.base_url"])
	textKey := firstConfigured(os.Getenv("APP_TEXT_API_KEY"), properties["ai.api_key"])
	textBaseURL := firstConfigured(os.Getenv("APP_TEXT_BASE_URL"), properties["ai.base_url"])
	imageKey := firstConfigured(os.Getenv("APP_IMAGE_API_KEY"), properties["ai.image_api_key"])
	imageBaseURL := firstConfigured(os.Getenv("APP_IMAGE_BASE_URL"), properties["ai.image_base_url"])
	return aiConfig{
		TextBaseURL:     textBaseURL,
		TextKey:         textKey,
		TextModel:       firstConfigured(os.Getenv("APP_TEXT_MODEL"), properties["ai.text_model"], defaultTextModel),
		TextProtocol:    firstConfigured(os.Getenv("APP_TEXT_PROTOCOL"), properties["ai.text_protocol"], "openai"),
		ImageBaseURL:    imageBaseURL,
		ImageKey:        imageKey,
		ImageModel:      firstConfigured(os.Getenv("APP_IMAGE_MODEL"), properties["ai.image_model"], defaultImageModel),
		ImageProtocol:   firstConfigured(os.Getenv("APP_IMAGE_PROTOCOL"), properties["ai.image_protocol"], "openai"),
		MimoBaseURL:     mimoBaseURL,
		MimoKey:         mimoKey,
		SeedanceBaseURL: seedanceBaseURL,
		SeedanceKey:     seedanceKey,
		SeedanceModel:   firstConfigured(os.Getenv("APP_SEEDANCE_MODEL"), properties["seedance.model"], defaultSeedanceModel),
		SeedanceCreate:  firstConfigured(os.Getenv("APP_SEEDANCE_CREATE_PATH"), properties["seedance.create_path"], defaultSeedanceCreate),
		SeedanceStatus:  firstConfigured(os.Getenv("APP_SEEDANCE_STATUS_PATH"), properties["seedance.status_path"], defaultSeedanceStatus),
	}
}

func firstConfigured(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

func requestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}
