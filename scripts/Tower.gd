extends Area2D

var damage = 30
var attack_range = 200
var fire_rate = 0.5
var last_shot_time = 0.0
var target = null
var projectile_scene = preload("res://scenes/Projectile.tscn")

func _ready():
	# 타워 그룹에 추가
	add_to_group("tower")
	
	# 시각적 요소 추가
	var color_rect = ColorRect.new()
	color_rect.size = Vector2(40, 40)
	color_rect.position = Vector2(-20, -20)
	color_rect.color = Color(0.2, 0.8, 0.2, 1)  # 초록색
	add_child(color_rect)
	
	# 충돌 모양 추가
	var collision = CollisionShape2D.new()
	var shape = CircleShape2D.new()
	shape.radius = 20
	collision.shape = shape
	add_child(collision)
	
	# 사거리 표시 (디버깅용)
	var range_circle = ColorRect.new()
	range_circle.size = Vector2(attack_range * 2, attack_range * 2)
	range_circle.position = Vector2(-attack_range, -attack_range)
	range_circle.color = Color(0.2, 0.8, 0.2, 0.1)  # 반투명 초록색
	add_child(range_circle)
	
	print("타워 초기화 완료! 위치: ", position, " 사거리: ", attack_range)

func _process(delta):
	last_shot_time += delta
	
	# 가장 가까운 적 찾기
	find_target()
	
	# 타겟이 있고 공격 가능하면 공격
	if target and last_shot_time >= fire_rate:
		print("타워 공격! 타겟: ", target.name, " 거리: ", position.distance_to(target.position))
		shoot()
	elif target:
		print("타워: 타겟 있음, 공격 쿨다운 중 (%.2f/%.2f)" % [last_shot_time, fire_rate])
	elif not target:
		print("타워: 타겟 없음")

func find_target():
	var enemies = get_tree().get_nodes_in_group("enemy")
	var closest_enemy = null
	var closest_distance = attack_range
	
	print("타워: 적 %d마리 발견" % enemies.size())
	
	for enemy in enemies:
		var distance = position.distance_to(enemy.position)
		print("타워: 적 거리 %.1f (사거리: %d)" % [distance, attack_range])
		if distance <= attack_range and distance < closest_distance:
			closest_enemy = enemy
			closest_distance = distance
			print("타워: 새로운 타겟 설정! 거리: %.1f" % distance)
	
	target = closest_enemy

func shoot():
	if not target:
		print("타워: 타겟이 없어서 공격 불가")
		return
	
	print("타워: 투사체 발사! 타겟: ", target.name)
	
	# 투사체 생성
	var projectile = projectile_scene.instantiate()
	get_tree().current_scene.add_child(projectile)
	
	# 투사체 위치 설정
	projectile.position = position
	
	# 타겟 방향으로 발사
	var direction = (target.position - position).normalized()
	projectile.set_direction(direction)
	projectile.set_damage(damage)
	
	print("타워: 투사체 생성 완료! 위치: ", position, " 방향: ", direction, " 데미지: ", damage)
	
	last_shot_time = 0.0

func upgrade_damage(amount):
	damage += amount
	print("타워 공격력 업그레이드: %d" % damage)

func upgrade_range(amount):
	attack_range += amount
	print("타워 사거리 업그레이드: %d" % attack_range)

func upgrade_speed(amount):
	fire_rate = max(0.1, fire_rate - amount)
	print("타워 공격속도 업그레이드: %.2f초" % fire_rate)
