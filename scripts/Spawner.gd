extends Node2D
@export var enemy_scene:PackedScene

# 웨이브 관련 변수들
var wave_data = {}
var current_wave = 0
var enemies_spawned = 0
var enemies_killed = 0
var main_node = null
var spawn_timer = 0.0
var spawn_interval = 0.0

func _ready():
	# 웨이브 데이터 로드
	load_wave_data()

func load_wave_data():
	var file = FileAccess.open("res://data/waves.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			wave_data = json.get_data()
		else:
			print("웨이브 데이터 파싱 실패: ", json.get_error_message())
	else:
		print("웨이브 데이터 파일을 찾을 수 없습니다")

func start_wave(wave_idx, main):
	current_wave = wave_idx
	main_node = main
	enemies_spawned = 0
	enemies_killed = 0
	
	# 웨이브 데이터에서 정보 가져오기
	var wave_key = str(wave_idx)
	if wave_data.has(wave_key):
		var wave_info = wave_data[wave_key]
		var enemy_count = wave_info.get("count", 1)
		var spawn_rate = wave_info.get("spawn_rate", 1.0)
		var hp_scale = wave_info.get("hp_scale", 1.0)
		
		# 스폰 간격 계산 (spawn_rate가 높을수록 빠르게)
		spawn_interval = 1.0 / spawn_rate
		spawn_timer = 0.0
		
		print("웨이브 %d 시작: 적 %d마리, HP 스케일 %.1f, 스폰 간격 %.2f초" % [wave_idx, enemy_count, hp_scale, spawn_interval])
	else:
		# 기본값으로 설정
		spawn_interval = 1.0
		spawn_timer = 0.0
		print("웨이브 %d 데이터 없음, 기본값 사용" % wave_idx)

func _process(delta):
	if main_node == null:
		return
		
	# 웨이브 데이터 확인
	var wave_key = str(current_wave)
	if not wave_data.has(wave_key):
		print("웨이브 %d 데이터가 없습니다! 기본값 사용" % current_wave)
		# 기본값으로 웨이브 진행
		var default_enemy_count = 10 + current_wave * 2  # 웨이브마다 적 수 증가
		var default_hp_scale = 1.0 + current_wave * 0.2  # 웨이브마다 HP 증가
		var default_spawn_rate = 1.0 + current_wave * 0.1  # 웨이브마다 스폰 속도 증가
		
		# 아직 스폰할 적이 남아있고, 스폰 타이머가 되었으면
		if enemies_spawned < default_enemy_count:
			spawn_timer += delta
			var current_spawn_interval = 1.0 / default_spawn_rate
			if spawn_timer >= current_spawn_interval:
				spawn_enemy(default_hp_scale)
				spawn_timer = 0.0
				enemies_spawned += 1
		
		# 모든 적을 스폰했고, 모든 적이 처리되었으면 웨이브 클리어
		elif enemies_spawned >= default_enemy_count:
			check_wave_clear()
		return
		
	var wave_info = wave_data[wave_key]
	var enemy_count = wave_info.get("count", 1)
	var wave_hp_scale = wave_info.get("hp_scale", 1.0)
	
	# 아직 스폰할 적이 남아있고, 스폰 타이머가 되었으면
	if enemies_spawned < enemy_count:
		spawn_timer += delta
		if spawn_timer >= spawn_interval:
			spawn_enemy(wave_hp_scale)
			spawn_timer = 0.0
			enemies_spawned += 1
	
	# 모든 적을 스폰했고, 모든 적이 처리되었으면 웨이브 클리어
	elif enemies_spawned >= enemy_count:
		check_wave_clear()

func spawn_enemy(hp_scale):
	var enemy = enemy_scene.instantiate()
	get_tree().current_scene.add_child(enemy)
	
	# 적 위치 설정 (경로의 시작점)
	enemy.position = Vector2(1200, 360)
	
	# HP 스케일 적용 (Enemy 스크립트에 hp_scale 변수가 있다고 가정)
	if enemy.has_method("set_hp_scale"):
		enemy.set_hp_scale(hp_scale)
	
	# 적이 죽었을 때 호출될 함수 연결
	if enemy.has_method("connect_death_signal"):
		print("Spawner: 적에게 죽음 신호 연결 시도")
		enemy.connect_death_signal(self, "on_enemy_killed")
		print("Spawner: 죽음 신호 연결 완료")
	else:
		print("Spawner: 적에 connect_death_signal 메서드가 없습니다!")
	
	print("적 스폰: 위치(%.0f, %.0f), HP 스케일 %.1f" % [enemy.position.x, enemy.position.y, hp_scale])

func on_enemy_killed():
	print("Spawner: on_enemy_killed 함수 호출됨!")
	enemies_killed += 1
	print("Spawner: 적 처치! %d/%d" % [enemies_killed, enemies_spawned])
	
	# Main 노드에 적 처치 알림
	if main_node and main_node.has_method("on_enemy_killed"):
		print("Main 노드에 골드 보상 알림")
		main_node.on_enemy_killed(5)  # 5골드 보상
	else:
		print("Main 노드를 찾을 수 없거나 on_enemy_killed 메서드가 없습니다!")
	
	# 웨이브 클리어 체크
	check_wave_clear()

func on_enemy_reach_base():
	# 적이 베이스에 도달했을 때도 처치된 것으로 카운트 (웨이브 클리어를 위해)
	enemies_killed += 1
	print("Spawner: 적이 베이스에 도달! %d/%d" % [enemies_killed, enemies_spawned])
	
	# 웨이브 클리어 체크
	check_wave_clear()

func notify_wave_cleared():
	print("웨이브 %d 클리어!" % current_wave)
	if main_node and main_node.has_method("notify_wave_cleared"):
		main_node.notify_wave_cleared()

func check_wave_clear():
	# 웨이브 데이터 확인
	var wave_key = str(current_wave)
	var enemy_count = 0
	
	if wave_data.has(wave_key):
		var wave_info = wave_data[wave_key]
		enemy_count = wave_info.get("count", 1)
	else:
		# 기본값으로 웨이브 진행
		enemy_count = 10 + current_wave * 2
	
	# 모든 적을 스폰했고, 모든 적이 처리되었으면 웨이브 클리어
	if enemies_spawned >= enemy_count and enemies_killed >= enemy_count:
		print("웨이브 클리어 조건 만족: %d/%d" % [enemies_killed, enemy_count])
		notify_wave_cleared()
