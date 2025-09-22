extends Node
signal wave_cleared(idx:int)
signal wave_timer_updated(remaining_time:int)
signal wave_timer_expired()
@export var enemy_scene:PackedScene
@export var spawn_interval:float = 0.7
var alive:int = 0
var wave_idx:int = 0
var wave_timer:float = 0.0
var wave_time_limit:float = 0.0
var is_wave_active:bool = false
func start_next_wave() -> void:
	var data = $"../DataHub".waves.get("list", [])
	var gm = $".."  # GameManager 참조를 함수 시작에서 한 번만 선언
	
	if wave_idx >= data.size():
		# 모든 웨이브 클리어 - 승리!
		if gm and gm.has_signal("game_over"):
			gm.emit_signal("game_over", true)
		emit_signal("wave_cleared", wave_idx); return
	
	var w = data[wave_idx]
	
	# 웨이브 타이머 설정
	wave_time_limit = w.get("timer", 60.0)  # 기본 60초
	wave_timer = wave_time_limit
	is_wave_active = true
	
	
	# GameManager에게 웨이브 시작 알림
	if gm and gm.has_signal("wave_changed"):
		gm.emit_signal("wave_changed", wave_idx + 1)
	
	# 적 스폰
	for g in w.get("groups", []):
		for i in g.get("count", 1):
			if not is_wave_active:  # 타이머 만료시 스폰 중단
				break
			await get_tree().create_timer(g.get("interval", 0.6)).timeout
			if is_wave_active:  # 다시 한번 확인
				_spawn_one(g.get("enemy", "goblin"))
		if not is_wave_active:
			break
	
	if w.has("boss") and is_wave_active:
		_spawn_one(w["boss"]["enemy"])
	
	# 모든 적이 처치되거나 타이머가 만료될 때까지 대기
	while alive > 0 and is_wave_active:
		await get_tree().process_frame
	
	is_wave_active = false
	wave_idx += 1
	emit_signal("wave_cleared", wave_idx)
func _spawn_one(enemy_id:String) -> void:
	var pool = $"../ObjectPool"
	var enemy = pool.pop("Enemy", func(): return enemy_scene.instantiate())
	var map = $"/root/Main/Map"
	
	
	# EnemyLayer 찾기 - 여러 방법 시도
	var enemy_layer = null
	
	# 방법 1: 직접 경로로 찾기
	enemy_layer = map.get_node_or_null("EnemyLayer")
	
	# 방법 2: find_child로 찾기
	if not enemy_layer:
		enemy_layer = map.find_child("EnemyLayer", true, false)
	
	# 방법 3: 모든 자식 중에서 찾기
	if not enemy_layer:
		for child in map.get_children():
			if child.name == "EnemyLayer":
				enemy_layer = child
				break
	
	if not enemy_layer:
		# EnemyLayer가 없으면 직접 생성
		enemy_layer = Node2D.new()
		enemy_layer.name = "EnemyLayer"
		map.add_child(enemy_layer)
	
	
	# Path2D 안전하게 찾기 (Path2D_A 또는 Path2D)
	var path:Path2D = map.get_node_or_null("Path2D_A")
	if not path:
		path = map.get_node_or_null("Path2D")
		if not path:
			return
	
	# PathFollow2D는 Path2D의 자식이어야 함
	path.add_child(enemy)
	
	# 적이 타일 위에 보이도록 z_index 설정
	enemy.z_index = 5
	
	enemy.init_from_config($"../DataHub".enemies.get(enemy_id, {}))
	
	print("적 생성됨: %s, z_index=%d, position=%s" % [enemy_id, enemy.z_index, enemy.global_position])
	
	enemy.connect("escaped", Callable(self, "_on_enemy_escaped"), CONNECT_ONE_SHOT)
	enemy.connect("died", Callable(self, "_on_enemy_died"), CONNECT_ONE_SHOT)
	alive += 1
func _process(delta: float) -> void:
	if is_wave_active and wave_timer > 0.0:
		wave_timer -= delta
		emit_signal("wave_timer_updated", int(wave_timer))
		
		if wave_timer <= 0.0:
			wave_timer = 0.0
			is_wave_active = false
			emit_signal("wave_timer_expired")
			_handle_timer_expiry()

func get_remaining_time() -> int:
	return int(wave_timer)

func _handle_timer_expiry() -> void:
	# 현재 남아있는 적의 수를 확인
	var remaining_enemies = alive
	
	if remaining_enemies > 0:
		# 남아있는 적 수만큼 라이프 차감
		$"..".damage_life(remaining_enemies)
		
		# 모든 적들을 제거
		_remove_all_enemies()
		
		# alive 카운트 리셋
		alive = 0

func _remove_all_enemies() -> void:
	# enemy 그룹에 속한 모든 적들을 찾아서 제거
	var enemies = get_tree().get_nodes_in_group("enemy")
	for enemy in enemies:
		if is_instance_valid(enemy):
			enemy.queue_free()

func _on_enemy_escaped() -> void:
	alive -= 1; $"..".damage_life(1)
func _on_enemy_died(reward:int) -> void:
	alive -= 1
	$"..".add_gold(reward)
