extends Area2D
class_name Projectile

var velocity: Vector2 = Vector2.ZERO
var damage: int = 0
var stats: Dictionary = {}
var target: Node = null
var speed: float = 600.0
var lifetime: float = 3.0

func shoot_at(t: Node, dmg: int, st: Dictionary) -> void:
    damage = dmg
    stats = st
    target = t
    var dir: Vector2 = (t.global_position - global_position).normalized()
    velocity = dir * speed
    print("Projectile created, moving towards: ", t.global_position, " with velocity: ", velocity)

func _ready() -> void:
    # 충돌 감지 연결
    body_entered.connect(_on_body_entered)
    # 수명 타이머 시작
    var timer: Timer = Timer.new()
    add_child(timer)
    timer.wait_time = lifetime
    timer.one_shot = true
    timer.timeout.connect(_on_lifetime_expired)
    timer.start()

func _physics_process(delta: float) -> void:
    global_position += velocity * delta

func _on_body_entered(body: Node2D) -> void:
    if body.has_method("take_damage"):
        print("Projectile hit enemy, dealing ", damage, " damage")
        body.take_damage(damage, "phys")
        queue_free()
    elif body.is_in_group("terrain"):
        print("Projectile hit terrain")
        queue_free()

func _on_lifetime_expired() -> void:
    print("Projectile lifetime expired")
    queue_free()