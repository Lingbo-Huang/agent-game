package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func withTestUser(req *http.Request) {
	raw, _ := json.Marshal(ssoUser{UserID: "42", Username: "tester", Email: "test@example.com"})
	req.Header.Set("X-User-Info", string(raw))
}

func TestHealthAndStatus(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{})
	for _, path := range []string{"/healthz", "/health", "/api/status"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		resp := httptest.NewRecorder()
		s.routes().ServeHTTP(resp, req)
		if resp.Code != http.StatusOK {
			t.Fatalf("%s: got %d", path, resp.Code)
		}
	}
}

func TestWhoamiRequiresSSO(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{})
	req := httptest.NewRequest(http.MethodGet, "/api/whoami", nil)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", resp.Code)
	}
}

func TestCharacterProposalsRequireSSO(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{})
	req := httptest.NewRequest(http.MethodPost, "/api/character-proposals", nil)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", resp.Code)
	}
}

func TestTTSRequiresSSO(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{MimoBaseURL: "https://example.invalid/v1", MimoKey: "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/tts", bytes.NewBufferString(`{"text":"你好","speaker":"narrator","delivery":"自然"}`))
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", resp.Code)
	}
}

func TestSeedanceRequiresSSO(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{SeedanceBaseURL: "https://example.invalid", SeedanceKey: "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/seedance/tasks", bytes.NewBufferString(`{"prompt":"一个足够长的电影镜头提示词"}`))
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", resp.Code)
	}
}

func TestSeedanceCreateAndLookup(t *testing.T) {
	var sawCreate, sawLookup, sawCreateModel bool
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer server-secret" {
			t.Fatalf("missing server key")
		}
		if r.Method == http.MethodPost {
			if r.URL.Path != "/v1/videos" {
				t.Fatalf("unexpected create path %q", r.URL.Path)
			}
			sawCreate = true
			var payload struct {
				Model  string `json:"model"`
				Prompt string `json:"prompt"`
			}
			if err := json.NewDecoder(r.Body).Decode(&payload); err == nil && payload.Model == defaultSeedanceModel && payload.Prompt != "" {
				sawCreateModel = true
			}
			_, _ = w.Write([]byte(`{"id":"task-1","status":"queued"}`))
			return
		}
		if r.URL.Path != "/v1/videos/task-1" {
			t.Fatalf("unexpected lookup path %q", r.URL.Path)
		}
		sawLookup = true
		_, _ = w.Write([]byte(`{"id":"task-1","status":"completed","video_url":"https://cdn.example/reel.mp4"}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{SeedanceBaseURL: upstream.URL, SeedanceKey: "server-secret"})
	create := httptest.NewRequest(http.MethodPost, "/api/seedance/tasks", bytes.NewBufferString(`{"prompt":"16比9电影镜头，雾港中的人物走向灯塔，水墨风格。"}`))
	create.Header.Set("Content-Type", "application/json")
	withTestUser(create)
	createResp := httptest.NewRecorder()
	s.routes().ServeHTTP(createResp, create)
	if createResp.Code != http.StatusAccepted || !strings.Contains(createResp.Body.String(), `"id":"task-1"`) {
		t.Fatalf("create: %d %s", createResp.Code, createResp.Body.String())
	}
	lookup := httptest.NewRequest(http.MethodGet, "/api/seedance/tasks/task-1", nil)
	withTestUser(lookup)
	lookupResp := httptest.NewRecorder()
	s.routes().ServeHTTP(lookupResp, lookup)
	if lookupResp.Code != http.StatusOK || !strings.Contains(lookupResp.Body.String(), `"status":"succeeded"`) || !strings.Contains(lookupResp.Body.String(), "reel.mp4") {
		t.Fatalf("lookup: %d %s", lookupResp.Code, lookupResp.Body.String())
	}
	if !sawCreate || !sawLookup || !sawCreateModel {
		t.Fatalf("missing upstream calls or create model: create=%v lookup=%v model=%v", sawCreate, sawLookup, sawCreateModel)
	}
}

func TestTTSRejectsUnknownSpeakerBeforeGateway(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{MimoBaseURL: "https://example.invalid/v1", MimoKey: "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/tts", bytes.NewBufferString(`{"text":"你好","speaker":"unknown","delivery":"自然"}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestTTSUsesServerKeyAndDirectorPrompt(t *testing.T) {
	var gotKey string
	var gotModel string
	var gotVoice string
	var gotDirection string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("api-key")
		var payload struct {
			Model    string                           `json:"model"`
			Messages []struct{ Role, Content string } `json:"messages"`
			Audio    struct {
				Voice string `json:"voice"`
			} `json:"audio"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		gotModel, gotVoice = payload.Model, payload.Audio.Voice
		if len(payload.Messages) > 0 {
			gotDirection = payload.Messages[0].Content
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"audio":{"data":"V0FW"}}}]}`))
	}))
	defer upstream.Close()

	s := newServer(t.TempDir(), aiConfig{MimoBaseURL: upstream.URL, MimoKey: "server-secret"})
	req := httptest.NewRequest(http.MethodPost, "/api/tts", bytes.NewBufferString(`{"text":"风从虎牢关吹过。","speaker":"captain","delivery":"低声而坚定"}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
	if gotKey != "server-secret" || gotModel != "mimo-v2.5-tts" || gotVoice != "白桦" {
		t.Fatalf("unexpected upstream request: key=%q model=%q voice=%q", gotKey, gotModel, gotVoice)
	}
	if !strings.Contains(gotDirection, "低声而坚定") || !strings.Contains(gotDirection, "资深裁决者") {
		t.Fatalf("director prompt missing: %q", gotDirection)
	}
}

func TestASRUsesMimoAudioMessage(t *testing.T) {
	var gotKey, gotModel, gotFormat, gotAudio string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("api-key")
		var payload struct {
			Model    string `json:"model"`
			Messages []struct {
				Content []struct {
					InputAudio struct{ Data, Format string } `json:"input_audio"`
				} `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		gotModel = payload.Model
		if len(payload.Messages) > 0 && len(payload.Messages[0].Content) > 0 {
			gotAudio = payload.Messages[0].Content[0].InputAudio.Data
			gotFormat = payload.Messages[0].Content[0].InputAudio.Format
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"风从虎牢关吹过。"}}]}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{MimoBaseURL: upstream.URL, MimoKey: "server-secret"})
	req := httptest.NewRequest(http.MethodPost, "/api/asr", bytes.NewBufferString(`{"audio":"QUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFB","mime":"audio/webm;codecs=opus"}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), "风从虎牢关吹过") {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
	if gotKey != "server-secret" || gotModel != "mimo-v2.5-asr" || gotFormat != "webm" || gotAudio == "" {
		t.Fatalf("unexpected upstream ASR: key=%q model=%q format=%q audio=%q", gotKey, gotModel, gotFormat, gotAudio)
	}
}

func TestLoadAIPropertiesMergesPrivateMimoProperties(t *testing.T) {
	dir := t.TempDir()
	oldDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(oldDir) }()
	if err := os.WriteFile("ai.properties", []byte("ai.base_url=https://text.example\nai.api_key=text-key\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile("mimo.properties", []byte("mimo.base_url=https://api.example/v1\nmimo.api_key=server-only\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	config := loadAIProperties("ai.properties")
	if config.TextKey != "text-key" || config.MimoKey != "server-only" || config.MimoBaseURL != "https://api.example/v1" || config.TextModel != defaultTextModel || config.ImageModel != defaultImageModel {
		t.Fatalf("properties not merged: %+v", config)
	}
}

func TestCallProviderPreservesQuotaStatusWithoutLeakingProviderBody(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write([]byte(`{"error":"secret provider diagnostics"}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{})
	_, status, err := s.callProvider(upstream.URL, "api-key", "secret", map[string]string{"hello": "world"})
	if status != http.StatusPaymentRequired || err == nil || !strings.Contains(err.Error(), "quota") || strings.Contains(err.Error(), "diagnostics") {
		t.Fatalf("unexpected quota handling: status=%d err=%v", status, err)
	}
}

func TestLoadAIPropertiesAcceptsTokenPlanEndpoint(t *testing.T) {
	dir := t.TempDir()
	oldDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(oldDir) }()
	testKey := "tp-" + strings.Repeat("x", 32)
	if err := os.WriteFile("mimo.properties", []byte("mimo.base_url=https://token-plan-cn.xiaomimimo.com/v1\nmimo.api_key="+testKey+"\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	config := loadAIProperties("ai.properties")
	if config.MimoKey != testKey || config.MimoBaseURL != "https://token-plan-cn.xiaomimimo.com/v1" {
		t.Fatalf("token plan must use its dedicated endpoint: %+v", config)
	}
}

func TestLoadAIPropertiesDoesNotShareVideoCredentials(t *testing.T) {
	dir := t.TempDir()
	oldDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(oldDir) }()
	if err := os.WriteFile("seedance.properties", []byte("seedance.base_url=https://video.example\nseedance.api_key=video-key\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	config := loadAIProperties("ai.properties")
	if config.SeedanceKey != "video-key" || config.SeedanceBaseURL != "https://video.example" || config.TextKey != "" || config.ImageKey != "" {
		t.Fatalf("provider credentials must remain isolated: %+v", config)
	}
}

func TestLoadAIPropertiesUsesExplicitProtocols(t *testing.T) {
	dir := t.TempDir()
	oldDir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() { _ = os.Chdir(oldDir) }()
	if err := os.WriteFile("ai.properties", []byte("ai.text_protocol=bedrock\nai.image_protocol=google\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	config := loadAIProperties("ai.properties")
	if config.TextProtocol != "bedrock" || config.ImageProtocol != "google" {
		t.Fatalf("explicit protocols missing: %+v", config)
	}
}

func TestPortraitUsesGPTImage2CompatibleEndpoint(t *testing.T) {
	var gotAuthorization, gotModel string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
		if r.URL.Path != "/v1/images/generations" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var payload struct {
			Model, OutputFormat string `json:"model"`
		}
		var raw map[string]any
		if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
			t.Fatal(err)
		}
		gotModel, _ = raw["model"].(string)
		if _, exists := raw["output_format"]; exists {
			t.Fatal("gateway does not accept output_format")
		}
		_ = payload
		_, _ = w.Write([]byte(`{"data":[{"b64_json":"V0VCUA=="}]}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{ImageBaseURL: upstream.URL, ImageKey: "image-secret", ImageModel: "gpt-image-2"})
	req := httptest.NewRequest(http.MethodPost, "/api/portrait", bytes.NewBufferString(`{"prompt":"电影感水墨历史场景，无文字，人物形象一致"}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), "data:image/png;base64,V0VCUA==") || gotAuthorization != "Bearer image-secret" || gotModel != "gpt-image-2" {
		t.Fatalf("portrait request/response mismatch: %d %s auth=%q model=%q", resp.Code, resp.Body.String(), gotAuthorization, gotModel)
	}
}

func TestPortraitSupportsGoogleCompatibleImageProtocol(t *testing.T) {
	var gotKey string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey = r.Header.Get("api-key")
		if r.URL.Path != "/google/v1:generateContent" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"candidates":[{"finishReason":"STOP","content":{"parts":[{"inlineData":{"mimeType":"image/webp","data":"V0VCUA=="}}]}}]}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{ImageBaseURL: upstream.URL, ImageKey: "google-image-secret", ImageProtocol: "google"})
	req := httptest.NewRequest(http.MethodPost, "/api/portrait", bytes.NewBufferString(`{"prompt":"电影感水墨历史场景，无文字，人物形象一致"}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), "data:image/webp;base64,V0VCUA==") || gotKey != "google-image-secret" {
		t.Fatalf("google-compatible image protocol mismatch: %d %s key=%q", resp.Code, resp.Body.String(), gotKey)
	}
}

func TestCallTextSupportsBedrockCompatibleProtocol(t *testing.T) {
	var gotToken string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotToken = r.Header.Get("token")
		if r.URL.Path != "/bedrock_runtime/model/invoke" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		_, _ = w.Write([]byte(`{"content":[{"text":"连续剧情"}]}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{TextBaseURL: upstream.URL, TextKey: "bedrock-text-secret", TextProtocol: "bedrock"})
	text, _, err := s.callText("继续剧情", 512)
	if err != nil || text != "连续剧情" || gotToken != "bedrock-text-secret" {
		t.Fatalf("bedrock-compatible text protocol mismatch: text=%q key=%q err=%v", text, gotToken, err)
	}
}

func TestStoryTurnKeepsNarrativeAndFiltersUnknownStateDelta(t *testing.T) {
	var directorPrompt string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		_ = json.NewDecoder(r.Body).Decode(&request)
		if len(request.Messages) > 0 {
			directorPrompt = request.Messages[0].Content
		}
		chapter := `{"title":"封印之后","paragraphs":["蒙恬把军印收入铜匣，当着两名驿吏的面压上封条。来使没有阻拦，只把右手按在诏书边缘，盯着每个人记名。","两名驿吏分头核对路线。一人发现使团比簿册快了两日，另一人却确认封缄没有破损。你的命令保住了调兵权，也让来使知道你在拖延。"],"characterReactions":[{"characterId":"mengtian","publicText":"印可以封，边军不能乱。给我一个复核期限。","intent":"保护边军并限制拖延"}],"suggestedActions":[{"id":"ask-envoy","title":"追问提前两日的原因","intent":"检验来使解释"},{"id":"set-deadline","title":"设定天亮前复核期限","intent":"避免无限拖延"}],"imagePrompts":["暗夜军帐，蒙恬将军印封入铜匣，两名驿吏分立核对簿册，历史电影感，无文字"],"newThread":"使团为何比驿传簿提前两日","stateDelta":{"location":"不存在的密道","itemChanges":[{"itemId":"seal","status":"封存"},{"itemId":"magic","status":"凭空出现"}],"resolvedThreadIds":["unknown-thread"]}}`
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":` + strconv.Quote(chapter) + `}}]}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{TextBaseURL: upstream.URL, TextKey: "text-secret", TextProtocol: "openai", TextModel: "claude-sonnet-5"})
	body := `{"worldId":"fusu","turn":0,"playerAction":"封存军印并让两名驿吏分别核对","currentLocation":"上郡营帐","stageGoal":"核验诏令","canonConstraints":["不能凭空造证据"],"allowedLocations":["上郡营帐"],"inventory":[],"itemStates":[{"id":"seal","name":"军印","holder":"蒙恬","status":"在手","purpose":"调兵"}],"recentEvents":[],"longTermSummary":[],"unresolvedThreads":[],"threadStates":[],"characters":[{"id":"mengtian","principles":["保护边军"],"goal":"复核诏令","emotion":"警惕","knownFacts":["军印在手"]}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/story-turn", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), "封印之后") || !strings.Contains(resp.Body.String(), `"itemId":"seal"`) || strings.Contains(resp.Body.String(), "不存在的密道") || strings.Contains(resp.Body.String(), `"itemId":"magic"`) || strings.Contains(resp.Body.String(), "unknown-thread") {
		t.Fatalf("story chapter should survive with unsafe deltas removed: %d %s", resp.Code, resp.Body.String())
	}
	for _, required := range []string{"第一句就出现具体动作或对象", "玩家原话行动", "有限知识、欲望与恐惧", "禁用“先观察一下”", "现代、清楚的中文短句"} {
		if !strings.Contains(directorPrompt, required) {
			t.Fatalf("director prompt should enforce concrete, readable consequences; missing %q", required)
		}
	}
}

func TestWorldSpecRequiresSSO(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{})
	req := httptest.NewRequest(http.MethodPost, "/api/world-spec", bytes.NewBufferString(`{"source":"我很犹豫","themeId":"decision"}`))
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("got %d", resp.Code)
	}
}

func TestWorldSpecRejectsInvalidThemeBeforeGateway(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{TextBaseURL: "https://example.invalid", TextKey: "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/world-spec", bytes.NewBufferString(`{"source":"我很犹豫","themeId":"anything"}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestHumanizeActionKeyNeverLeaksInternalStateKeys(t *testing.T) {
	cases := map[string]string{
		"talk:partner":      "与一个相关角色核对立场",
		"investigate:deck":  "核对一条具体信息",
		"observe:harbor":    "先观察可见事实",
		"move:captain_room": "换到另一个信息来源",
		"use:combined":      "连接两份独立信息",
		"wait:time":         "暂时等待局势变化",
	}
	for input, want := range cases {
		got := humanizeActionKey(input)
		if got != want || strings.Contains(got, ":") {
			t.Fatalf("humanizeActionKey(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestCharacterProposalsRejectInvalidContextBeforeGateway(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{TextBaseURL: "https://example.invalid", TextKey: "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/character-proposals", bytes.NewBufferString(`{"turn":1,"actionType":"talk","characters":[]}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestCharacterProposalsCallEveryCharacterInIsolation(t *testing.T) {
	called := make(chan string, 3)
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" || r.Header.Get("Authorization") != "Bearer server-secret" {
			t.Fatalf("unexpected text request: %s %q", r.URL.Path, r.Header.Get("Authorization"))
		}
		var payload struct {
			Model    string `json:"model"`
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || len(payload.Messages) != 1 {
			t.Fatalf("invalid model payload: %v", err)
		}
		content := payload.Messages[0].Content
		var id string
		for _, candidate := range []string{"partner", "witness", "captain"} {
			if strings.Contains(content, `"id":"`+candidate+`"`) {
				id = candidate
			}
		}
		if id == "" {
			t.Fatalf("missing isolated character id in %s", content)
		}
		// A private context must never contain another character's identity.
		for _, other := range []string{"partner", "witness", "captain"} {
			if other != id && strings.Contains(content, `"id":"`+other+`"`) {
				t.Fatalf("%s received %s private context", id, other)
			}
		}
		called <- id
		if payload.Model != defaultTextModel {
			t.Fatalf("unexpected model: %q", payload.Model)
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"action\":{\"npcId\":\"` + id + `\",\"kind\":\"observe\",\"intent\":\"按原则观察\",\"reason\":\"只依据自己的已知事实\",\"publicText\":\"角色停下来核对眼前的信息。\",\"emphasis\":\"normal\"}}"}}]}`))
	}))
	defer upstream.Close()
	s := newServer(t.TempDir(), aiConfig{TextBaseURL: upstream.URL, TextKey: "server-secret"})
	body := `{"turn":2,"actionType":"talk","targetId":"partner","characters":[{"id":"partner","principles":["保护边界"],"goal":"说明立场","emotion":"guarded","knownFacts":["收到询问"]},{"id":"witness","principles":["只说所见"],"goal":"保存记录","emotion":"calm","knownFacts":["看见记录"]},{"id":"captain","principles":["先复核"],"goal":"检查证据","emotion":"determined","knownFacts":["收到材料"]}]}`
	req := httptest.NewRequest(http.MethodPost, "/api/character-proposals", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"mode":"parallel-per-character"`) || !strings.Contains(resp.Body.String(), `"agentsConsulted":3`) {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
	seen := map[string]bool{}
	for range 3 {
		seen[<-called] = true
	}
	if len(seen) != 3 {
		t.Fatalf("expected three isolated calls, got %v", seen)
	}
}

func TestNarrateRejectsEmptyPromptBeforeGateway(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{TextBaseURL: "https://example.invalid", TextKey: "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/narrate", bytes.NewBufferString(`{"systemPrompt":"rules","userPrompt":"  "}`))
	req.Header.Set("Content-Type", "application/json")
	withTestUser(req)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestWhoamiParsesTrustedIdentityHeader(t *testing.T) {
	s := newServer(t.TempDir(), aiConfig{})
	req := httptest.NewRequest(http.MethodGet, "/api/whoami", nil)
	raw, _ := json.Marshal(ssoUser{UserID: "42", Username: "小红", Email: "x@example.com"})
	req.Header.Set("X-User-Info", string(raw))
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK {
		t.Fatalf("got %d: %s", resp.Code, resp.Body.String())
	}
}

func TestFrontendFallback(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<h1>REDVERSE</h1>"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := newServer(dir, aiConfig{})
	req := httptest.NewRequest(http.MethodGet, "/some/client/route", nil)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusOK || resp.Body.String() != "<h1>REDVERSE</h1>" {
		t.Fatalf("got %d %q", resp.Code, resp.Body.String())
	}
}

func TestFrontendNeverServesPrivateProperties(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "seedance.properties"), []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	s := newServer(dir, aiConfig{})
	req := httptest.NewRequest(http.MethodGet, "/seedance.properties", nil)
	resp := httptest.NewRecorder()
	s.routes().ServeHTTP(resp, req)
	if resp.Code != http.StatusNotFound || strings.Contains(resp.Body.String(), "secret") {
		t.Fatalf("secret exposed: %d %q", resp.Code, resp.Body.String())
	}
}

func TestStrictJSONTextExtractsOuterObject(t *testing.T) {
	got := strictJSONText("这里是结果：\n```json\n{\"title\":\"献刀\"}\n```\n请继续")
	if got != `{"title":"献刀"}` {
		t.Fatalf("unexpected JSON extraction: %q", got)
	}
}

func TestNormalizeStoryParagraphsSplitsLongSingleParagraph(t *testing.T) {
	input := "董卓接过宝刀，手指停在磨白的握痕上。门外甲叶碰响，吕布已经走到门前。曹操压住呼吸，知道下一句话会决定他能否活着离开。案上的烛火晃了一下，门缝里的影子已经遮住半面地砖。"
	got := normalizeStoryParagraphs([]string{input})
	if len(got) != 2 || strings.Join(got, "") != input {
		t.Fatalf("unexpected paragraphs: %#v", got)
	}
}
