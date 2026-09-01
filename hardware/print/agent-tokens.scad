// REDVERSE 可打印角色图腾与镜像底座
// OpenSCAD: F6 Render -> Export STL. 默认免支撑，0.2mm 层高。
$fn = 96;

part = "all"; // all | player | witness | partner | captain | gate

module token(symbol="P", notch=0) {
  difference() {
    union() {
      cylinder(h=3.2, d=40);
      translate([0,0,3.2]) linear_extrude(height=1.0)
        text(symbol, size=18, halign="center", valign="center", font="Arial:style=Bold");
    }
    // 3mm 挂绳孔；底部平面可贴 28mm AprilTag/ArUco 标签。
    translate([0,14,-.2]) cylinder(h=5, d=3.4);
    // 触觉识别凹点：不同角色数量不同，儿童也能摸出差异。
    for (i=[0:notch-1]) rotate([0,0,i*18-(notch-1)*9]) translate([0,-18.6,1.4]) sphere(d=2.4);
  }
}

module gate() {
  difference() {
    union() {
      translate([-45,-24,0]) cube([90,48,5]);
      translate([0,0,5]) difference() {
        rotate([90,0,0]) cylinder(h=10,d=62,center=true);
        rotate([90,0,0]) cylinder(h=12,d=48,center=true);
      }
    }
    // 四个 41mm 插槽；放入图腾可配摄像头标记或 ESP32 开关。
    for (x=[-31,-10.5,10.5,31]) translate([x,-13,3.2]) cylinder(h=4,d=41);
  }
}

module spread() {
  translate([-66,32,0]) token("P",1);
  translate([-22,32,0]) token("W",2);
  translate([22,32,0]) token("A",3);
  translate([66,32,0]) token("C",4);
  translate([0,-32,0]) gate();
}

if (part == "all") spread();
if (part == "player") token("P",1);
if (part == "witness") token("W",2);
if (part == "partner") token("A",3);
if (part == "captain") token("C",4);
if (part == "gate") gate();
