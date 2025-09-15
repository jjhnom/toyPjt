extends CharacterBody2D

var speed = 200
var projectile_scene = preload("res://scenes/Projectile.tscn")
var attack_damage = 25
var attack_cooldown = 0.5
var attack_range = 800  # 사거리 추가
var last_attack_time = 0.0

func _ready():
		# 입력 처리 모드 명시적 설정
		process_mode = Node.PROCESS_MODE_ALWAYS
		
		# player 그룹에 추가 (투사체 충돌 방지용)
		add_to_group("player")
		
		print("플레이어 초기화 완료! 위치: %s, 공격력: %d, 쿨다운: %.2f초, 사거리: %d" % [position, attack_damage, attack_cooldown, attack_range])


func _physics_process(delta):
		# 이동 처리 - 직접 키 입력 사용
		var d = Vector2()
		
		# 직접 키 입력
		if Input.is_key_pressed(KEY_W):
				d.y -= 1
		if Input.is_key_pressed(KEY_S):
				d.y += 1
		if Input.is_key_pressed(KEY_A):
				d.x -= 1
		if Input.is_key_pressed(KEY_D):
				d.x += 1
		
		velocity = d.normalized() * speed
		move_and_slide()
		
		# 화면 경계 제한
		position.x = clamp(position.x, 16, 1264)  # 화면 너비 1280에서 16씩 여백
		position.y = clamp(position.y, 16, 704)   # 화면 높이 720에서 16씩 여백
		
		# 공격 처리
		handle_attack(delta)

func handle_attack(delta):
		last_attack_time += delta
		
		# 여러 가지 입력 방법으로 공격 감지
		var attack_pressed = false
		
		# 1. 액션 기반 입력
		if Input.is_action_just_pressed("attack"):
				attack_pressed = true
				print("플레이어: 액션 기반 공격 감지!")
		
		# 2. 직접 마우스 버튼 감지
		elif Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT):
				attack_pressed = true
				print("플레이어: 직접 마우스 버튼 감지!")
		
		# 3. 스페이스바로도 공격 가능 (테스트용)
		elif Input.is_action_just_pressed("ui_accept"):
				attack_pressed = true
				print("플레이어: 스페이스바 공격 감지!")
		
		if attack_pressed and last_attack_time >= attack_cooldown:
				print("플레이어: 공격 시도! 쿨다운: %.2f/%.2f" % [last_attack_time, attack_cooldown])
				shoot_projectile()
				last_attack_time = 0.0
		elif attack_pressed:
				print("플레이어: 공격 시도했지만 쿨다운 중 (%.2f/%.2f)" % [last_attack_time, attack_cooldown])

func shoot_projectile():
		print("플레이어: 투사체 발사 시작!")
		
		# 투사체 생성
		var projectile = projectile_scene.instantiate()
		get_tree().current_scene.add_child(projectile)
		
		# 투사체 위치 설정 (플레이어 위치에서 약간 앞으로)
		var mouse_pos = get_global_mouse_position()
		var direction = (mouse_pos - position).normalized()
		projectile.position = position + direction * 30  # 플레이어에서 30픽셀 앞에 생성
		
		# 방향 설정
		projectile.set_direction(direction)
		
		# 데미지와 사거리 설정
		projectile.set_damage(attack_damage)
		projectile.set_range(attack_range)
		
		print("플레이어: 투사체 발사 완료! 위치: %s, 방향: %s, 데미지: %d, 사거리: %d" % [projectile.position, direction, attack_damage, attack_range])

func upgrade_attack_damage(amount):
	attack_damage += amount
	print("공격력 업그레이드: %d" % attack_damage)

func upgrade_attack_speed(amount):
	attack_cooldown = max(0.1, attack_cooldown - amount)
	print("공격 속도 업그레이드: 쿨다운 %.2f초" % attack_cooldown)

func upgrade_attack_range(amount):
	attack_range += amount
	print("사거리 업그레이드: %d" % attack_range)

# 현재 스탯 정보 반환
func get_stats():
	return {
		"damage": attack_damage,
		"cooldown": attack_cooldown,
		"range": attack_range
	}
