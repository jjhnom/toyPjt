
extends Node2D

@onready var spawner = $Spawner
@onready var hud = $HUD
@onready var player = $Player

# 게임 상태 변수들
var current_wave = 0
var game_state = "playing"  # "playing", "paused", "game_over"
var wave_cleared = false
var upgrade_data = {}

func _ready():
	# 윈도우 포커스 강제 설정
	get_window().grab_focus()
	
	# 업그레이드 데이터 로드
	load_upgrade_data()
	
	# 게임 시작
	start_game()

func load_upgrade_data():
	var file = FileAccess.open("res://data/upgrades.json", FileAccess.READ)
	if file:
		var json_string = file.get_as_text()
		file.close()
		var json = JSON.new()
		var parse_result = json.parse(json_string)
		if parse_result == OK:
			upgrade_data = json.get_data()
			print("업그레이드 데이터 로드 완료")
		else:
			print("업그레이드 데이터 파싱 실패: ", json.get_error_message())
	else:
		print("업그레이드 데이터 파일을 찾을 수 없습니다")

func start_game():
	print("게임 시작!")
	game_state = "playing"
	current_wave = 0
	wave_cleared = false
	start_next_wave()

func start_next_wave():
	if game_state != "playing":
		return
		
	current_wave += 1
	wave_cleared = false
	
	print("웨이브 %d 시작" % current_wave)
	
	# HUD 업데이트
	hud.set_wave(current_wave)
	
	# Spawner에 웨이브 시작 알림
	spawner.start_wave(current_wave, self)

func on_enemy_killed(reward: int = 5):
	if game_state != "playing":
		print("게임이 플레이 중이 아닙니다!")
		return
		
	print("Main: 적 처치! 골드 +%d" % reward)
	hud.update_gold(reward)
	print("HUD에 골드 업데이트 완료")
	
	# Spawner에 적 처치 카운트만 증가 (무한 루프 방지)
	if spawner:
		print("Spawner에 적 처치 카운트 증가")
		spawner.enemies_killed += 1
		print("Spawner: 적 처치! %d/%d" % [spawner.enemies_killed, spawner.enemies_spawned])

func on_enemy_reach_base(damage: int = 1):
	if game_state != "playing":
		return
		
	print("베이스 데미지! -%d HP" % damage)
	hud.update_base_hp(-damage)
	
	# 게임 오버 체크
	if hud.is_game_over():
		game_over()

func notify_wave_cleared():
	if game_state != "playing" or wave_cleared:
		return
		
	wave_cleared = true
	print("웨이브 %d 클리어!" % current_wave)
	
	# 웨이브 클리어 보상
	var wave_reward = current_wave * 10
	hud.update_gold(wave_reward)
	print("웨이브 클리어 보상: +%d 골드" % wave_reward)
	
	# 2초 후 다음 웨이브 시작
	await get_tree().create_timer(2.0).timeout
	start_next_wave()

func game_over():
	game_state = "game_over"
	print("게임 오버! 최종 웨이브: %d" % current_wave)
	
	# 게임 오버 처리 (재시작 버튼 등 추가 가능)
	# 현재는 콘솔에 메시지만 출력

func _input(event):
	# ESC 키로 게임 일시정지/재개
	if event.is_action_pressed("ui_cancel"):
		toggle_pause()
	
	# R 키로 게임 재시작
	if event.is_action_pressed("ui_accept") and game_state == "game_over":
		restart_game()

func toggle_pause():
	if game_state == "playing":
		game_state = "paused"
		get_tree().paused = true
		print("게임 일시정지")
	elif game_state == "paused":
		game_state = "playing"
		get_tree().paused = false
		print("게임 재개")

func restart_game():
	print("게임 재시작!")
	get_tree().paused = false
	
	# 모든 적과 투사체 제거
	clear_all_enemies()
	clear_all_projectiles()
	
	# 게임 상태 초기화
	start_game()

func clear_all_enemies():
	# 모든 적 제거
	var enemies = get_tree().get_nodes_in_group("enemy")
	for enemy in enemies:
		if is_instance_valid(enemy):
			enemy.queue_free()

func clear_all_projectiles():
	# 모든 투사체 제거
	var projectiles = get_tree().get_nodes_in_group("projectile")
	for projectile in projectiles:
		if is_instance_valid(projectile):
			projectile.queue_free()

# 업그레이드 시스템 (향후 확장용)
func try_upgrade_attack():
	if upgrade_data.has("attack"):
		var attack_upgrade = upgrade_data["attack"][0]  # 첫 번째 업그레이드
		var cost = attack_upgrade.get("cost", 30)
		var delta = attack_upgrade.get("delta", 5)
		
		if hud.spend_gold(cost):
			player.upgrade_attack_damage(delta)
			print("공격력 업그레이드 완료! 비용: %d골드" % cost)
			return true
		else:
			print("골드가 부족합니다! 필요: %d골드" % cost)
			return false
	return false

func try_upgrade_speed():
	if upgrade_data.has("speed"):
		var speed_upgrade = upgrade_data["speed"][0]  # 첫 번째 업그레이드
		var cost = speed_upgrade.get("cost", 25)
		var delta = speed_upgrade.get("delta", 20)
		
		if hud.spend_gold(cost):
			player.upgrade_attack_speed(delta / 100.0)  # 퍼센트를 소수로 변환
			print("공격 속도 업그레이드 완료! 비용: %d골드" % cost)
			return true
		else:
			print("골드가 부족합니다! 필요: %d골드" % cost)
			return false
	return false
