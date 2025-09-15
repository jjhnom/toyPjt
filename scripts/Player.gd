extends CharacterBody2D

var speed = 200
var projectile_scene = preload("res://scenes/Projectile.tscn")
var attack_damage = 25
var attack_cooldown = 0.5
var last_attack_time = 0.0

func _ready():
	# 입력 처리 모드 명시적 설정
	process_mode = Node.PROCESS_MODE_ALWAYS
	
	# player 그룹에 추가 (투사체 충돌 방지용)
	add_to_group("player")


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
	
	# 마우스 클릭 직접 감지
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and last_attack_time >= attack_cooldown:
		shoot_projectile()
		last_attack_time = 0.0

func shoot_projectile():
	# 투사체 생성
	var projectile = projectile_scene.instantiate()
	get_tree().current_scene.add_child(projectile)
	
	# 투사체 위치 설정 (플레이어 위치)
	projectile.position = position
	
	# 마우스 방향으로 발사
	var mouse_pos = get_global_mouse_position()
	var direction = (mouse_pos - position).normalized()
	projectile.set_direction(direction)
	
	# 데미지 설정
	projectile.set_damage(attack_damage)

func upgrade_attack_damage(amount):
	attack_damage += amount
	print("공격력 업그레이드: %d" % attack_damage)

func upgrade_attack_speed(amount):
	attack_cooldown = max(0.1, attack_cooldown - amount)
	print("공격 속도 업그레이드: 쿨다운 %.2f초" % attack_cooldown)