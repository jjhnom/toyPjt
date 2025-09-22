extends Area2D
@export var speed:float = 340.0
var target:Node
var damage:int
func shoot_at(t:Node, d:int) -> void:
    target = t; damage = d; set_process(true)
    # 타겟 방향으로 화살 회전
    if is_instance_valid(target):
        var direction = (target.global_position - global_position).normalized()
        rotation = direction.angle()
func _process(delta:float) -> void:
    if not is_instance_valid(target): _recycle(); return
    var dir = (target.global_position - global_position).normalized()
    # 타겟 방향으로 계속 회전
    rotation = dir.angle()
    global_position += dir * speed * delta
    if global_position.distance_to(target.global_position) < 8.0:
        if target.has_method("take_damage"): target.take_damage(damage)
        _recycle()
func _recycle() -> void:
    set_process(false)
    $"/root/Main/GameManager/ObjectPool".push("Projectile", self)

func set_sprite(sprite_path: String) -> void:
    # 프로젝타일 스프라이트 설정
    if has_node("Sprite2D"):
        var sprite = get_node("Sprite2D")
        var texture = load(sprite_path)
        if texture:
            sprite.texture = texture