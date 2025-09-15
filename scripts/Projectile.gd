extends Area2D

var speed = 400
var damage = 25
var direction = Vector2.RIGHT

func _ready():
	# 충돌 감지 연결
	body_entered.connect(_on_body_entered)
	area_entered.connect(_on_area_entered)
	
	# projectile 그룹에 추가 (정리용)
	add_to_group("projectile")

func _physics_process(delta): 
	position += direction * speed * delta
	
	# 화면 밖으로 나가면 제거
	if position.x > 1300 or position.x < -100 or position.y > 800 or position.y < -100:
		queue_free()

func _on_body_entered(body):
	print("투사체가 body와 충돌: ", body.name)
	# 플레이어와 충돌하면 무시
	if body.is_in_group("player"):
		print("플레이어와 충돌 - 무시")
		return
	# 적과 충돌했을 때
	if body.is_in_group("enemy"):
		print("적과 충돌 감지!")
		hit_enemy(body)

func _on_area_entered(area):
	print("투사체가 area와 충돌: ", area.name)
	# 다른 Area2D와 충돌했을 때 (적이 Area2D인 경우)
	if area.is_in_group("enemy"):
		print("적과 충돌 감지!")
		hit_enemy(area)

func hit_enemy(enemy):
	print("적에게 데미지 주기: ", damage)
	# 적에게 데미지 주기
	if enemy.has_method("take_damage"):
		enemy.take_damage(damage)
		print("데미지 전달 완료")
	else:
		print("take_damage 메서드가 없습니다!")
	
	# 투사체 제거
	queue_free()

func set_damage(dmg):
	damage = dmg

func set_direction(dir):
	direction = dir.normalized()