extends Area2D
@export var speed:float = 340.0
var target:Node
var damage:int
func shoot_at(t:Node, d:int) -> void:
    target = t; damage = d; set_process(true)
func _process(delta:float) -> void:
    if not is_instance_valid(target): _recycle(); return
    var dir = (target.global_position - global_position).normalized()
    global_position += dir * speed * delta
    if global_position.distance_to(target.global_position) < 8.0:
        if target.has_method("take_damage"): target.take_damage(damage)
        _recycle()
func _recycle() -> void:
    set_process(false)
    $"/root/Main/GameManager/ObjectPool".push("Projectile", self)
