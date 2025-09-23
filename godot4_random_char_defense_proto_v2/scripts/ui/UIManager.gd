extends Node
@onready var gold_label:Label = $HUD/Gold
@onready var life_label:Label = $HUD/Life
@onready var wave_label:Label = $HUD/Wave
@onready var timer_label:Label = $HUD/Timer
@onready var btn_summon:Button = $HUD/Summon
@onready var btn_s2:Button = $HUD/Skill2
@onready var btn_sell:Button = $HUD/Sell
@onready var btn_speed:Button = $HUD/Speed
@onready var bgm_player:AudioStreamPlayer = $"../BGM"

var _current_speed: float = 1.0

func _ready() -> void:
	# BGM 반복 재생 설정
	if bgm_player:
		bgm_player.finished.connect(_on_bgm_finished)

func bind(gm:Node) -> void:
	# 게임 속도를 기본값으로 리셋
	Engine.time_scale = 1.0
	
	gm.connect("gold_changed", Callable(self, "_on_gold"))
	gm.connect("life_changed", Callable(self, "_on_life"))
	gm.connect("wave_changed", Callable(self, "_on_wave"))
	gm.connect("game_over", Callable(self, "_on_game_over"))
	
	# WaveManager 타이머 신호 연결
	var wave_manager = $"/root/Main/GameManager/WaveManager"
	if wave_manager:
		wave_manager.connect("wave_timer_updated", Callable(self, "_on_timer_updated"))
		wave_manager.connect("wave_timer_expired", Callable(self, "_on_timer_expired"))
	
	# 초기 UI 값 설정
	_on_gold(gm.gold)
	_on_life(gm.life)
	if wave_manager:
		_on_wave(wave_manager.wave_idx + 1)  # 현재 웨이브 번호 (1부터 시작)
	else:
		_on_wave(1)  # 기본값
	
	# 버튼들이 초기화되었는지 확인 후 연결
	if btn_summon: 
		btn_summon.pressed.connect(_on_summon_pressed)
		
		
	if btn_s2: 
		btn_s2.pressed.connect(_on_skill2_pressed)
		
		
	if btn_sell:
		btn_sell.pressed.connect(_on_sell_pressed)
	
	# 속도 조절 버튼 연결
	if btn_speed:
		btn_speed.pressed.connect(_on_speed_pressed)
	
	# 초기 속도 버튼 상태 설정
	_current_speed = 1.0
	_update_speed_button()

func _on_summon_pressed() -> void:
	var character_manager = $"/root/Main/GameManager/CharacterManager"
	if character_manager:
		# 빈 슬롯이 있는지 먼저 확인
		if not character_manager.has_empty_slot():
			# 빈 슬롯이 없으면 시각적 피드백 제공
			_show_no_slots_feedback()
			return
		
		# 빈 슬롯이 있으면 소환 실행
		character_manager.summon(50)

func _on_skill2_pressed() -> void:
	print("GlobalSlow 스킬 버튼 클릭됨")
	$"/root/Main/GameManager/SkillManager".use_global_slow()

func _show_no_slots_feedback() -> void:
	# 소환 버튼에 시각적 피드백 (빨간색 깜빡임)
	if btn_summon:
		var original_color = btn_summon.modulate
		var tween = create_tween()
		tween.set_loops(2)
		tween.tween_property(btn_summon, "modulate", Color.RED, 0.1)
		tween.tween_property(btn_summon, "modulate", original_color, 0.1)
		
		# 텍스트도 잠시 변경
		var original_text = btn_summon.text
		btn_summon.text = "슬롯 없음!"
		await get_tree().create_timer(1.0).timeout
		btn_summon.text = original_text

func _on_sell_pressed() -> void:
	var character_manager = $"/root/Main/GameManager/CharacterManager"
	if character_manager:
		# 선택된 캐릭터가 있는지 확인
		var sell_price = character_manager.sell_selected_character()
		if sell_price > 0:
			_show_sell_feedback(sell_price)
		else:
			_show_no_selection_feedback()

func _show_sell_feedback(price: int) -> void:
	# 판매 성공 피드백 (초록색 깜빡임)
	if btn_sell:
		var original_color = btn_sell.modulate
		var tween = create_tween()
		tween.set_loops(2)
		tween.tween_property(btn_sell, "modulate", Color.GREEN, 0.1)
		tween.tween_property(btn_sell, "modulate", original_color, 0.1)
		
		# 텍스트도 잠시 변경
		var original_text = btn_sell.text
		btn_sell.text = "+%d골드!" % price
		await get_tree().create_timer(1.0).timeout
		btn_sell.text = original_text

func _show_no_selection_feedback() -> void:
	# 선택된 캐릭터가 없을 때 피드백 (빨간색 깜빡임)
	if btn_sell:
		var original_color = btn_sell.modulate
		var tween = create_tween()
		tween.set_loops(2)
		tween.tween_property(btn_sell, "modulate", Color.RED, 0.1)
		tween.tween_property(btn_sell, "modulate", original_color, 0.1)
		
		# 텍스트도 잠시 변경
		var original_text = btn_sell.text
		btn_sell.text = "선택 필요!"
		await get_tree().create_timer(1.0).timeout
		btn_sell.text = original_text

func _unhandled_input(event:InputEvent) -> void:
	# 마우스 버튼이나 터치 이벤트만 처리
	if event is InputEventMouseButton or event is InputEventScreenTouch or event is InputEventMouseMotion or event is InputEventScreenDrag:
		# 드래그 입력을 CharacterManager로 전달
		var char_manager = $"/root/Main/GameManager/CharacterManager"
		if char_manager and char_manager.has_method("handle_input"):
			char_manager.handle_input(event)
		
		# 기존 선택 기능도 유지 (드래그가 아닌 단순 터치일 때)
		if event is InputEventScreenTouch and event.pressed:
			char_manager.toggle_select_at(event.position)
func _on_gold(v:int) -> void: 
	if gold_label: 
		gold_label.text = "Gold: %d" % v

func _on_life(v:int) -> void: 
	if life_label: 
		life_label.text = "Life: %d" % v

func _on_wave(i:int) -> void: 
	if wave_label: 
		wave_label.text = "Wave: %d" % i
func _on_timer_updated(remaining_time:int) -> void: 
	if timer_label: 
		timer_label.text = "Time: %d" % remaining_time
		# 시간이 10초 이하면 빨간색으로 표시
		if remaining_time <= 10:
			timer_label.modulate = Color.RED
		else:
			timer_label.modulate = Color.WHITE
func _on_timer_expired() -> void:
	if timer_label: 
		timer_label.text = "TIME UP!"
		timer_label.modulate = Color.RED
		
		# 3초 후 다시 정상 표시로 복구
		var timer = get_tree().create_timer(3.0)
		timer.timeout.connect(func(): 
			if timer_label:
				timer_label.text = "Time: 0"
				timer_label.modulate = Color.WHITE
		)

func _on_game_over(win: bool) -> void:
	print("게임 오버! 승리: %s" % win)
	
	# 게임 정지
	get_tree().paused = true
	
	# 속도를 기본값으로 리셋
	_current_speed = 1.0
	Engine.time_scale = 1.0
	_update_speed_button()
	
	# 게임오버 UI 표시
	_show_game_over_screen(win)

func _show_game_over_screen(win: bool) -> void:
	# 기존 게임오버 패널이 있다면 제거
	var existing_panel = get_node_or_null("GameOverPanel")
	if existing_panel:
		existing_panel.queue_free()
	
	# 게임오버 화면 생성
	var game_over_panel = Panel.new()
	game_over_panel.name = "GameOverPanel"
	game_over_panel.z_index = 100  # 최상위 표시
	game_over_panel.process_mode = Node.PROCESS_MODE_ALWAYS  # 일시정지 상태에서도 처리
	
	# 패널 크기 및 위치 설정
	var viewport_size = get_viewport().size
	game_over_panel.size = viewport_size
	game_over_panel.position = Vector2.ZERO
	
	# 배경색 설정
	var style = StyleBoxFlat.new()
	if win:
		style.bg_color = Color(0.2, 0.6, 0.2, 0.9)  # 승리 - 초록색
	else:
		style.bg_color = Color(0.6, 0.2, 0.2, 0.9)  # 패배 - 빨간색
	game_over_panel.add_theme_stylebox_override("panel", style)
	
	# 메인 컨테이너 추가
	var vbox = VBoxContainer.new()
	vbox.anchors_preset = Control.PRESET_CENTER
	vbox.anchor_left = 0.5
	vbox.anchor_right = 0.5
	vbox.anchor_top = 0.5
	vbox.anchor_bottom = 0.5
	vbox.offset_left = -250
	vbox.offset_right = 250
	vbox.offset_top = -200
	vbox.offset_bottom = 200
	vbox.add_theme_constant_override("separation", 20)  # 요소 간 간격
	
	# 게임오버 텍스트
	var title_label = Label.new()
	if win:
		title_label.text = "게임 승리!"
		title_label.modulate = Color.GOLD
	else:
		title_label.text = "게임 오버!"
		title_label.modulate = Color.RED
	
	var title_settings = LabelSettings.new()
	title_settings.font_size = 48
	title_settings.font_color = Color.WHITE
	title_settings.outline_size = 4
	title_settings.outline_color = Color.BLACK
	title_label.label_settings = title_settings
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	
	# 현재 웨이브 정보
	var wave_info = Label.new()
	var wave_manager = $"/root/Main/GameManager/WaveManager"
	var current_wave = 1
	if wave_manager:
		current_wave = wave_manager.wave_idx
	
	wave_info.text = "클리어한 웨이브: %d" % current_wave
	var info_settings = LabelSettings.new()
	info_settings.font_size = 24
	info_settings.font_color = Color.WHITE
	info_settings.outline_size = 2
	info_settings.outline_color = Color.BLACK
	wave_info.label_settings = info_settings
	wave_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	
	# 다시 시작 버튼
	var restart_button = Button.new()
	restart_button.text = "다시 시작"
	restart_button.custom_minimum_size = Vector2(200, 50)
	restart_button.process_mode = Node.PROCESS_MODE_ALWAYS  # 일시정지 상태에서도 처리
	restart_button.pressed.connect(func(): 
		print("다시 시작 버튼 클릭됨!")
		_restart_game()
	)
	
	# 다시 시작 버튼 스타일
	var restart_style = StyleBoxFlat.new()
	restart_style.bg_color = Color(0.2, 0.7, 0.2, 0.9)  # 초록색 배경
	restart_style.border_width_left = 2
	restart_style.border_width_right = 2
	restart_style.border_width_top = 2
	restart_style.border_width_bottom = 2
	restart_style.border_color = Color.WHITE
	restart_style.corner_radius_top_left = 10
	restart_style.corner_radius_top_right = 10
	restart_style.corner_radius_bottom_left = 10
	restart_style.corner_radius_bottom_right = 10
	restart_button.add_theme_stylebox_override("normal", restart_style)
	
	# 종료 버튼
	var quit_button = Button.new()
	quit_button.text = "게임 종료"
	quit_button.custom_minimum_size = Vector2(200, 50)
	quit_button.process_mode = Node.PROCESS_MODE_ALWAYS  # 일시정지 상태에서도 처리
	quit_button.pressed.connect(func(): 
		print("게임 종료 버튼 클릭됨!")
		_quit_game()
	)
	
	# 종료 버튼 스타일
	var quit_style = StyleBoxFlat.new()
	quit_style.bg_color = Color(0.7, 0.2, 0.2, 0.9)  # 빨간색 배경
	quit_style.border_width_left = 2
	quit_style.border_width_right = 2
	quit_style.border_width_top = 2
	quit_style.border_width_bottom = 2
	quit_style.border_color = Color.WHITE
	quit_style.corner_radius_top_left = 10
	quit_style.corner_radius_top_right = 10
	quit_style.corner_radius_bottom_left = 10
	quit_style.corner_radius_bottom_right = 10
	quit_button.add_theme_stylebox_override("normal", quit_style)
	
	# 컨테이너에 요소들 추가
	vbox.add_child(title_label)
	vbox.add_child(wave_info)
	vbox.add_child(restart_button)
	vbox.add_child(quit_button)
	
	game_over_panel.add_child(vbox)
	get_parent().add_child(game_over_panel)  # CanvasLayer에 직접 추가

func _restart_game() -> void:
	print("게임 재시작 요청됨")
	
	# 기존 게임오버 패널 제거
	var existing_panel = get_parent().get_node_or_null("GameOverPanel")
	if existing_panel:
		existing_panel.queue_free()
		print("게임오버 패널 제거됨")
	
	# 게임 일시정지 해제
	get_tree().paused = false
	print("게임 일시정지 해제됨")
	
	# 속도를 기본값으로 리셋
	_current_speed = 1.0
	Engine.time_scale = 1.0
	print("게임 속도 1x로 리셋됨")
	
	# 잠시 대기 후 씬 다시 로드 (UI 정리를 위해)
	await get_tree().process_frame
	get_tree().reload_current_scene()
	print("씬 재로드 완료")

func _quit_game() -> void:
	print("게임 종료 요청됨")
	
	# 기존 게임오버 패널 제거
	var existing_panel = get_parent().get_node_or_null("GameOverPanel")
	if existing_panel:
		existing_panel.queue_free()
		print("게임오버 패널 제거됨")
	
	# 게임 일시정지 해제
	get_tree().paused = false
	print("게임 일시정지 해제됨")
	
	# 속도를 기본값으로 리셋
	_current_speed = 1.0
	Engine.time_scale = 1.0
	print("게임 속도 1x로 리셋됨")
	
	# 잠시 대기 후 게임 종료
	await get_tree().process_frame
	get_tree().quit()
	print("게임 종료됨")

# 속도 조절 함수들
func _on_speed_pressed() -> void:
	# 1x → 2x → 3x → 1x 순서로 변경
	if _current_speed == 1.0:
		_current_speed = 2.0
	elif _current_speed == 2.0:
		_current_speed = 3.0
	else:
		_current_speed = 1.0
	
	# 게임 속도 적용
	Engine.time_scale = _current_speed
	print("게임 속도 변경: %.1fx" % _current_speed)
	
	# 버튼 텍스트 업데이트
	_update_speed_button()

func _update_speed_button() -> void:
	if btn_speed:
		btn_speed.text = "%.0fx" % _current_speed
		
		# 속도에 따른 버튼 색상 변경
		if _current_speed == 1.0:
			btn_speed.modulate = Color.WHITE
		elif _current_speed == 2.0:
			btn_speed.modulate = Color.YELLOW
		else:  # 3.0
			btn_speed.modulate = Color.ORANGE_RED

func _on_bgm_finished() -> void:
	# BGM이 끝나면 다시 재생
	if bgm_player:
		print("BGM 재생 완료 - 다시 재생 시작")
		bgm_player.play()
