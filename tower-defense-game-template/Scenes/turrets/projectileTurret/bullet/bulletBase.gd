extends Node2D

var bullet_type := "":
	set(value):
		bullet_type = value
		$AnimatedSprite2D.sprite_frames = load(Data.bullets[value]["frames"])

var target = null
var direction: Vector2

var speed: float = 400.0
var damage: float = 10
var pierce: int = 1
var time: float = 1.0

func _process(delta):
	if target:
		if not direction: 
			direction= (target - position).normalized()
		position += direction * speed * delta

func _on_area_2d_area_entered(area):
	var obj = area.get_parent()
	if obj.is_in_group("enemy"):
		pierce -= 1
		obj.get_damage(damage)
<<<<<<< HEAD
=======
		
		# 위자드 불릿인 경우 슬로우 효과 적용
		if bullet_type == "magic":
			obj.apply_slow(0.5, 2.0)  # 50% 속도로 2초간 슬로우
		
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd
	if pierce == 0:
		queue_free()

func _on_disappear_timer_timeout():
	queue_free()
