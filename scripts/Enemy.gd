extends CharacterBody2D

var speed = 100
var max_hp = 100
var current_hp = 100
var hp_scale = 1.0
var gold_reward = 5

# 경로 관련 변수들
var path_points = []
var current_path_index = 0
var path_finished = false

# 죽음 신호
signal enemy_died

func _ready():
	# HP 스케일 적용
	current_hp = max_hp * hp_scale
	max_hp = current_hp
	
	# enemy 그룹에 추가 (투사체 충돌 감지용)
	add_to_group("enemy")
	
	# 경로 설정
	setup_path()

func _physics_process(_delta): 
	# 경로를 따라 이동
	if not path_finished and current_path_index < path_points.size():
		var target_point = path_points[current_path_index]
		var direction = (target_point - position).normalized()
		
		# 목표 지점에 가까워지면 다음 지점으로 이동
		if position.distance_to(target_point) < 10:
			current_path_index += 1
			if current_path_index >= path_points.size():
				path_finished = true
				damage_base()
				queue_free()
				return
		else:
			velocity = direction * speed
			move_and_slide()
	else:
		# 경로가 끝났으면 베이스에 데미지
		damage_base()
		queue_free()

func set_hp_scale(scale_value):
	hp_scale = scale_value
	current_hp = max_hp * hp_scale
	max_hp = current_hp

func take_damage(damage):
	print("적이 데미지 받음: ", damage, " 현재 HP: ", current_hp)
	current_hp -= damage
	print("데미지 후 HP: ", current_hp)
	if current_hp <= 0:
		die()

func die():
	print("적이 죽음!")
	
	# 직접 Main 노드에 알림
	var main = get_tree().current_scene
	if main and main.has_method("on_enemy_killed"):
		print("Main 노드에 직접 적 처치 알림")
		main.on_enemy_killed(5)  # 5골드 보상
	else:
		print("Main 노드를 찾을 수 없거나 on_enemy_killed 메서드가 없습니다!")
	
	# 죽음 신호도 발생 (기존 방식) - 인수 없이 발생
	print("죽음 신호 발생 시도...")
	enemy_died.emit()
	print("죽음 신호 발생 완료")
	print("적 처치: HP 0")
	queue_free()

func damage_base():
	# Main 노드에 베이스 데미지 알림
	var main = get_tree().current_scene
	if main and main.has_method("on_enemy_reach_base"):
		main.on_enemy_reach_base(1)
	
	# Spawner에도 적이 베이스에 도달했다고 알림 (웨이브 클리어를 위해)
	var spawner = main.get_node("Spawner")
	if spawner and spawner.has_method("on_enemy_reach_base"):
		spawner.on_enemy_reach_base()

func setup_path():
	# 기본 경로 설정 (오른쪽에서 시작해서 왼쪽으로 이동)
	# 화면 크기: 1280x720
	path_points = [
		Vector2(1200, 360),  # 시작점 (오른쪽)
		Vector2(1000, 360),  # 첫 번째 구간
		Vector2(1000, 200),  # 위로 올라가기
		Vector2(600, 200),   # 왼쪽으로 이동
		Vector2(600, 500),   # 아래로 내려가기
		Vector2(200, 500),   # 왼쪽으로 이동
		Vector2(200, 360),   # 위로 올라가기
		Vector2(-50, 360)    # 베이스 (왼쪽 끝)
	]
	
	print("적 경로 설정 완료! 경로 포인트 수: ", path_points.size())

func connect_death_signal(target, method_name):
	print("Enemy: 죽음 신호 연결 시도 - 대상: ", target, " 메서드: ", method_name)
	enemy_died.connect(Callable(target, method_name))
	print("Enemy: 죽음 신호 연결 완료")
