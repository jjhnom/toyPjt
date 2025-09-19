extends Node
@onready var gold_label:Label = $HUD/Gold
@onready var life_label:Label = $HUD/Life
@onready var wave_label:Label = $HUD/Wave
@onready var timer_label:Label = $HUD/Timer
@onready var btn_summon:Button = $HUD/Summon
@onready var btn_merge:Button = $HUD/Merge
@onready var btn_s1:Button = $HUD/Skill1
@onready var btn_s2:Button = $HUD/Skill2
@onready var btn_s3:Button = $HUD/Skill3

func _ready() -> void:
	pass

func bind(gm:Node) -> void:
	# 게임 속도를 기본값으로 리셋
	Engine.time_scale = 1.0
	
	gm.connect("gold_changed", Callable(self, "_on_gold"))
	gm.connect("life_changed", Callable(self, "_on_life"))
	gm.connect("wave_changed", Callable(self, "_on_wave"))
	
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
		
	if btn_merge: 
		btn_merge.pressed.connect(func(): pass) # tap two slots on playfield
		
	if btn_s1: 
		btn_s1.pressed.connect(func(): $"/root/Main/GameManager/SkillManager".use_arrow_rain())
		
	if btn_s2: 
		btn_s2.pressed.connect(func(): $"/root/Main/GameManager/SkillManager".use_global_slow())
		
	if btn_s3: 
		btn_s3.pressed.connect(func(): $"/root/Main/GameManager/SkillManager".use_heal_gate())
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
