# Godot 4.x
extends AnimatedSprite2D

@export var sprite_strip_path := "res://assets/enemies/dino1.png"
@export var anim_name := "run"
@export var fps := 12.0

func _ready() -> void:
    var tex := load(sprite_strip_path) as Texture2D
    assert(tex, "스프라이트 이미지 로드 실패: %s" % sprite_strip_path)

    var frame_size := tex.get_height()                 # 한 프레임 높이(=24)
    var frame_count := int(tex.get_width() / frame_size)  # 576/24=24

    var frames := SpriteFrames.new()
    frames.add_animation(anim_name)
    frames.set_animation_speed(anim_name, fps)

    for i in range(frame_count):
        var atlas := AtlasTexture.new()
        atlas.atlas = tex
        atlas.region = Rect2(i * frame_size, 0, frame_size, frame_size)
        frames.add_frame(anim_name, atlas)

    sprite_frames = frames
    animation = anim_name
    play()
