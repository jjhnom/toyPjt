extends Node
@onready var data = $"../DataHub"
@onready var gm = $".."
var slots := [] # {pos:Vector2, node:Node, area:Area2D}
var selected := -1
var layer: Node2D

# 드래그 관련 변수들
var dragging_character: Node2D = null
var dragging_from_slot: int = -1
var drag_offset: Vector2 = Vector2.ZERO
var original_position: Vector2 = Vector2.ZERO

# 사거리 표시 관련 변수들
var range_indicator: Node2D = null
var selected_character: Node2D = null

# 업그레이드 UI 관련 변수들
var upgrade_panel: Control = null
var atk_upgrade_button: Button = null
var range_upgrade_button: Button = null

# 통계 표시 UI 관련 변수들
var stats_panel: Control = null
var stats_name_label: Label = null
var stats_level_label: Label = null
var stats_atk_label: Label = null
var stats_range_label: Label = null
var stats_rate_label: Label = null
var stats_rarity_label: Label = null

func _ready() -> void:
	# 새로운 맵의 슬롯들을 찾아서 등록
	# Builder가 슬롯을 생성할 시간을 충분히 주기 위해 더 늦게 호출
	await get_tree().create_timer(0.1).timeout
	call_deferred("_setup_layer_and_slots")

func _setup_layer_and_slots() -> void:
	# CharacterLayer 찾기
	layer = get_node_or_null("/root/Main/Map/CharacterLayer")
	if not layer:
		# 대안 경로 시도
		layer = get_node_or_null("../../Map/CharacterLayer")
		if not layer:
			return
	
	_setup_slots()
	_create_range_indicator()
	_create_upgrade_ui()
	_create_stats_ui()
	
	# 슬롯 설정 완료 후 UI 상태 업데이트
	call_deferred("_update_initial_ui_state")

func _setup_slots() -> void:
	
	# 여러 경로 시도
	var slots_root = get_node_or_null("/root/Main/Map/Slots")
	if not slots_root:
		slots_root = get_node_or_null("../../Map/Slots")
		if not slots_root:
			# Map의 자식들을 확인
			var map_node = get_node_or_null("/root/Main/Map")
			if map_node:
				# 직접 Slots 찾기
				for child in map_node.get_children():
					if child.name == "Slots":
						slots_root = child
						break
			else:
				return
	
	if not slots_root:
		return
	
	
	slots.clear()
	for child in slots_root.get_children():
		if child is Area2D:
			slots.append({"pos": child.global_position, "node": null, "area": child})
	
# 빈 슬롯이 있는지 확인하는 공개 함수
func has_empty_slot() -> bool:
	return _find_empty_slot() >= 0

# 캐릭터 판매 기능
func sell_character_at(slot_index: int) -> int:
	if slot_index < 0 or slot_index >= slots.size():
		return 0
	
	var character = slots[slot_index]["node"]
	if not character:
		return 0
	
	# 캐릭터의 판매 가격 계산 (구매가의 절반)
	var sell_price = _calculate_sell_price(character)
	
	# 판매하는 캐릭터가 선택된 캐릭터인지 확인
	if selected_character == character:
		selected_character = null
		if range_indicator:
			range_indicator.visible = false
	
	# 선택된 슬롯 인덱스 업데이트
	if selected == slot_index:
		selected = -1
	
	# 캐릭터 제거
	character.queue_free()
	slots[slot_index]["node"] = null
	
	# 골드 지급
	if gm:
		gm.add_gold(sell_price)
	
	
	# 슬롯 상태 체크 및 UI 업데이트
	_check_slot_status_and_update_ui()
	
	return sell_price

# 캐릭터 판매 가격 계산
func _calculate_sell_price(character: Node2D) -> int:
	if not character:
		return 0
	
	# 기본 캐릭터 비용
	var base_cost = data.characters[character.id].get("cost", 50)
	
	# 레벨에 따른 추가 비용 (레벨업할 때마다 약 2배씩 증가하는 것으로 가정)
	var level_multiplier = pow(2, character.level - 1)
	var total_cost = base_cost * level_multiplier
	
	# 판매가는 총 비용의 절반
	return int(total_cost * 0.5)

# 선택된 캐릭터 판매
func sell_selected_character() -> int:
	if not selected_character:
		return 0
	
	# selected_character가 어느 슬롯에 있는지 찾기
	for i in slots.size():
		if slots[i]["node"] == selected_character:
			return sell_character_at(i)
	
	return 0

func summon(cost:int=50) -> void:
	# 먼저 빈 슬롯이 있는지 확인
	var idx = _find_empty_slot()
	if idx < 0: 
		return
	
	# 빈 슬롯이 있으면 골드 차감
	if not gm.spend_gold(cost): 
		return
	
	var keys = data.characters.keys()
	if keys.is_empty(): 
		return
	
	# 가중치를 고려한 랜덤 소환
	var id = _get_random_character_by_weight()
	
	var c = preload("res://scenes/Character.tscn").instantiate()
	
	if not layer:
		_setup_layer_and_slots()
		if not layer:
			return
	
	layer.add_child(c)
	
	c.init_from_config(data.characters[id], 1, id)
	
	c.global_position = slots[idx]["pos"]
	slots[idx]["node"] = c
	
	
	
	# 소환 이펙트 (간단한 크기 애니메이션)
	_play_summon_effect(c)
	
	# 슬롯 상태 체크 및 UI 업데이트
	_check_slot_status_and_update_ui()

func _play_summon_effect(character: Node2D) -> void:
	if not character:
		return
	
	
	# 캐릭터의 최종 스케일 저장 (이미 JSON과 레벨에 따라 설정됨)
	var target_scale = character.scale
	
	# 처음에는 작게 시작해서 목표 크기로 확대
	character.scale = Vector2(0.1, 0.1)
	character.modulate = Color.WHITE
	character.visible = true
	
	
	# 크기 확대 + 깜빡임 효과
	var tween = create_tween()
	tween.set_parallel(true)  # 병렬 실행
	tween.tween_property(character, "scale", target_scale, 0.3)  # 크기 확대
	tween.tween_property(character, "modulate", Color.YELLOW, 0.15)  # 노란색으로
	tween.tween_property(character, "modulate", Color.WHITE, 0.15)   # 다시 흰색으로
func toggle_select_at(pos:Vector2) -> void:
	var idx = _slot_at(pos); if idx < 0: return
	if selected == -1: selected = idx
	else:
		if selected != idx: _try_merge(selected, idx)
		selected = -1

func handle_input(event: InputEvent) -> void:
	
	# 터치 이벤트 (모바일)
	if event is InputEventScreenTouch:
		if event.pressed:
			_start_drag(event.position)
		else:
			_end_drag(event.position)
	elif event is InputEventScreenDrag and dragging_character:
		_update_drag(event.position)
	
	# 마우스 이벤트 (데스크톱)
	elif event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				_start_drag(event.position)
			else:
				_end_drag(event.position)
	elif event is InputEventMouseMotion and dragging_character:
		_update_drag(event.position)

func _start_drag(pos: Vector2) -> void:
	var idx = _slot_at(pos)
	
	if idx >= 0 and slots[idx]["node"] != null:
		var character = slots[idx]["node"] as Node2D
		if character:
			# 캐릭터 선택 (사거리 표시)
			select_character(character)
			
			dragging_character = character
			dragging_from_slot = idx
			original_position = character.global_position
			drag_offset = character.global_position - pos
			
			# 드래그 중인 캐릭터를 위로 올림 (z_index 증가)
			character.z_index = 100
			
			# 원래 슬롯에서 제거 (임시)
			slots[idx]["node"] = null
	else:
		# 빈 공간 클릭 시 선택 해제
		deselect_character()

func _update_drag(pos: Vector2) -> void:
	if dragging_character:
		dragging_character.global_position = pos + drag_offset

func _end_drag(pos: Vector2) -> void:
	if not dragging_character:
		return
	
	# 드롭할 슬롯 찾기
	var target_idx = _slot_at(pos)
	
	if target_idx >= 0 and slots[target_idx]["node"] == null:
		# 빈 슬롯에 드롭 성공
		slots[target_idx]["node"] = dragging_character
		dragging_character.global_position = slots[target_idx]["pos"]
		dragging_character.z_index = 0  # z_index 원복
		
		# 사거리 표시기 위치 업데이트
		if selected_character == dragging_character:
			_update_range_indicator_position()
		
		# 성공적으로 이동했으므로 원래 슬롯은 비워둠
		
	elif target_idx >= 0 and slots[target_idx]["node"] != null:
		# 다른 캐릭터가 있는 슬롯에 드롭 - 합성 시도
		var target_character = slots[target_idx]["node"]
		if _can_merge(dragging_character, target_character):
			# 합성 가능
			_perform_merge(dragging_from_slot, target_idx, dragging_character, target_character)
		else:
			# 합성 불가능 - 위치 교체
			_perform_swap(dragging_from_slot, target_idx, dragging_character, target_character)
	else:
		# 유효하지 않은 위치 - 원래 위치로 복귀
		_return_to_original_position()
	
	# 드래그 상태 초기화
	dragging_character = null
	dragging_from_slot = -1
	drag_offset = Vector2.ZERO
	original_position = Vector2.ZERO
	
	# 슬롯 상태 체크 및 UI 업데이트
	_check_slot_status_and_update_ui()

func _return_to_original_position() -> void:
	if dragging_character and dragging_from_slot >= 0:
		slots[dragging_from_slot]["node"] = dragging_character
		dragging_character.global_position = slots[dragging_from_slot]["pos"]
		dragging_character.z_index = 0

# 두 캐릭터의 위치를 교체하는 함수
func _perform_swap(from_slot: int, to_slot: int, dragging_char: Node2D, target_char: Node2D) -> void:
	if from_slot < 0 or to_slot < 0 or from_slot >= slots.size() or to_slot >= slots.size():
		return
	
	# 슬롯 정보 교체
	slots[from_slot]["node"] = target_char
	slots[to_slot]["node"] = dragging_char
	
	# 위치 이동
	target_char.global_position = slots[from_slot]["pos"]
	dragging_char.global_position = slots[to_slot]["pos"]
	
	# z_index 원복
	target_char.z_index = 0
	dragging_char.z_index = 0
	
	# 사거리 표시기 위치 업데이트
	if selected_character == dragging_char:
		_update_range_indicator_position()
	elif selected_character == target_char:
		_update_range_indicator_position()
	
func _try_merge(a:int, b:int) -> void:
	if slots[a]["node"] == null or slots[b]["node"] == null: return
	var A = slots[a]["node"]; var B = slots[b]["node"]
	if _can_merge(A, B):
		_perform_merge(a, b, A, B)
func _slot_at(p:Vector2) -> int:
	for i in slots.size():
		if slots[i]["pos"].distance_to(p) < 60.0: return i  # 더 큰 슬롯 크기에 맞춤 (120px 타일 기준)
	return -1
func _find_empty_slot() -> int:
	for i in slots.size():
		if slots[i]["node"] == null: return i
	return -1

func _get_random_character_by_weight() -> String:
	# 가중치 기반 랜덤 선택
	var characters = data.characters
	var total_weight = 0
	var weighted_chars = []
	
	# 모든 캐릭터의 가중치 합계 계산
	for char_id in characters.keys():
		var char_data = characters[char_id]
		var weight = char_data.get("spawn_weight", 1)  # 기본 가중치 1
		total_weight += weight
		weighted_chars.append({"id": char_id, "weight": weight})
	
	
	# 랜덤 값 생성 (0 ~ total_weight)
	var random_value = randf() * total_weight
	
	# 가중치에 따라 캐릭터 선택
	var current_weight = 0.0
	for char_info in weighted_chars:
		current_weight += char_info["weight"]
		if random_value <= current_weight:
			return char_info["id"]
	
	# 안전장치: 마지막 캐릭터 반환
	return weighted_chars[-1]["id"] if not weighted_chars.is_empty() else "archer"

func _can_merge(char_a: Node2D, char_b: Node2D) -> bool:
	if not char_a or not char_b:
		return false
	return char_a.id == char_b.id and char_a.level == char_b.level and char_a.level < 6

func _perform_merge(from_slot: int, to_slot: int, char_a: Node2D, char_b: Node2D) -> void:
	
	# 기존 캐릭터들 제거
	char_a.queue_free()
	char_b.queue_free()
	slots[from_slot]["node"] = null  # from_slot도 비우기
	slots[to_slot]["node"] = null
	
	# 새로운 높은 레벨 캐릭터 생성
	var new_id = _get_random_character_by_weight()
	var new_level = char_a.level + 1
	var c = preload("res://scenes/Character.tscn").instantiate()
	
	if not layer:
		return
	
	layer.add_child(c)
	c.init_from_config(data.characters[new_id], new_level, new_id)
	c.global_position = slots[to_slot]["pos"]
	slots[to_slot]["node"] = c
	
	
	# 합성 이펙트
	_play_merge_effect(c)
	
	# 슬롯 상태 체크 및 UI 업데이트
	_check_slot_status_and_update_ui()

# 사거리 표시기 생성
func _create_range_indicator() -> void:
	if not layer:
		return
	
	range_indicator = RangeIndicator.new()
	range_indicator.name = "RangeIndicator"
	range_indicator.visible = false
	layer.add_child(range_indicator)

# 사거리 원 그리기
func _draw_range_circle(character: Node2D) -> void:
	if not range_indicator or not character:
		return
	
	# 사거리 정보 전달
	range_indicator.set_character_range(character.attack_range)
	range_indicator.global_position = character.global_position

# 캐릭터 선택
func select_character(character: Node2D) -> void:
	# 이전 선택 해제
	deselect_character()
	
	if character:
		selected_character = character
		
		# selected 인덱스도 업데이트
		for i in slots.size():
			if slots[i]["node"] == character:
				selected = i
				break
		
		_show_range_indicator(character)
		_update_upgrade_ui(character)
		_update_stats_ui(character)

# 캐릭터 선택 해제
func deselect_character() -> void:
	selected_character = null
	selected = -1  # 인덱스도 리셋
	_hide_range_indicator()
	_hide_upgrade_ui()
	_hide_stats_ui()

# 사거리 표시기 보이기
func _show_range_indicator(character: Node2D) -> void:
	if not range_indicator or not character:
		return
	
	range_indicator.global_position = character.global_position
	range_indicator.visible = true
	_draw_range_circle(character)

# 사거리 표시기 숨기기
func _hide_range_indicator() -> void:
	if range_indicator:
		range_indicator.visible = false

# 사거리 표시기 위치 업데이트
func _update_range_indicator_position() -> void:
	if range_indicator and selected_character:
		range_indicator.global_position = selected_character.global_position

func _play_merge_effect(character: Node2D) -> void:
	if not character:
		return
		
	
	# 합성 이펙트: 크기 펄스 + 색상 변화
	var target_scale = character.scale
	character.scale = target_scale * 1.5  # 1.5배로 시작
	character.modulate = Color.GREEN
	
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(character, "scale", target_scale, 0.4)
	tween.tween_property(character, "modulate", Color.WHITE, 0.4)

# 업그레이드 UI 생성
func _create_upgrade_ui() -> void:
	# UI 컨테이너 생성
	upgrade_panel = Control.new()
	upgrade_panel.name = "UpgradePanel"
	upgrade_panel.visible = false
	upgrade_panel.z_index = 50  # UI 레이어로 설정 (더 높게)
	upgrade_panel.mouse_filter = Control.MOUSE_FILTER_STOP  # 마우스 이벤트 완전 차단
	
	# UI 스타일 설정
	var style_box = StyleBoxFlat.new()
	style_box.bg_color = Color(0, 0, 0, 0.8)
	style_box.corner_radius_top_left = 10
	style_box.corner_radius_top_right = 10
	style_box.corner_radius_bottom_left = 10
	style_box.corner_radius_bottom_right = 10
	upgrade_panel.add_theme_stylebox_override("panel", style_box)
	
	# 패널 크기 설정
	upgrade_panel.custom_minimum_size = Vector2(300, 120)
	upgrade_panel.position = Vector2(50, 50)  # 화면 상단에 배치 (오른쪽으로 이동)
	
	# 제목 라벨
	var title_label = Label.new()
	title_label.text = "캐릭터 업그레이드"
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.position = Vector2(10, 10)
	title_label.size = Vector2(280, 30)
	
	var title_style = LabelSettings.new()
	title_style.font_size = 18
	title_style.font_color = Color.WHITE
	title_style.outline_size = 2
	title_style.outline_color = Color.BLACK
	title_label.label_settings = title_style
	
	upgrade_panel.add_child(title_label)
	
	# 공격력 업그레이드 버튼
	atk_upgrade_button = Button.new()
	atk_upgrade_button.text = "공격력 업그레이드"
	atk_upgrade_button.position = Vector2(20, 50)
	atk_upgrade_button.size = Vector2(120, 40)
	atk_upgrade_button.mouse_filter = Control.MOUSE_FILTER_STOP  # 마우스 이벤트 완전 차단
	atk_upgrade_button.z_index = 100  # 슬롯보다 훨씬 앞에 배치
	atk_upgrade_button.pressed.connect(_on_atk_upgrade_pressed)
	# 마우스 이벤트 전파 방지 (제거 - pressed 신호만 사용)
	# atk_upgrade_button.gui_input.connect(_on_upgrade_button_gui_input)
	
	# 사거리 업그레이드 버튼
	range_upgrade_button = Button.new()
	range_upgrade_button.text = "사거리 업그레이드"
	range_upgrade_button.position = Vector2(160, 50)
	range_upgrade_button.size = Vector2(120, 40)
	range_upgrade_button.mouse_filter = Control.MOUSE_FILTER_STOP  # 마우스 이벤트 완전 차단
	range_upgrade_button.z_index = 100  # 슬롯보다 훨씬 앞에 배치
	range_upgrade_button.pressed.connect(_on_range_upgrade_pressed)
	# 마우스 이벤트 전파 방지 (제거 - pressed 신호만 사용)
	# range_upgrade_button.gui_input.connect(_on_upgrade_button_gui_input)
	
	upgrade_panel.add_child(atk_upgrade_button)
	upgrade_panel.add_child(range_upgrade_button)
	
	# UI를 Main의 CanvasLayer에 추가
	var main = get_node_or_null("/root/Main")
	if main:
		main.add_child(upgrade_panel)

# 업그레이드 UI 업데이트
func _update_upgrade_ui(character: Node2D) -> void:
	if not upgrade_panel or not character:
		return
	
	# 6레벨 이상인지 확인
	if character.level >= 6:
		upgrade_panel.visible = true
	else:
		upgrade_panel.visible = false
		return
	
	# 공격력 업그레이드 버튼 상태 업데이트
	var can_upgrade_atk = character.can_upgrade_attack()
	atk_upgrade_button.disabled = not can_upgrade_atk
	
	if can_upgrade_atk:
		var cost = character.get_upgrade_cost("attack")
		atk_upgrade_button.text = "공격력 +%d\n(%d골드)" % [character._get_character_config().get("upgrades", {}).get("atk_upgrade_amount", 5), cost]
	else:
		atk_upgrade_button.text = "공격력 최대"
	
	# 사거리 업그레이드 버튼 상태 업데이트
	var can_upgrade_range = character.can_upgrade_range()
	range_upgrade_button.disabled = not can_upgrade_range
	
	if can_upgrade_range:
		var cost = character.get_upgrade_cost("range")
		range_upgrade_button.text = "사거리 +%d\n(%d골드)" % [character._get_character_config().get("upgrades", {}).get("range_upgrade_amount", 30), cost]
	else:
		range_upgrade_button.text = "사거리 최대"

# 업그레이드 UI 숨기기
func _hide_upgrade_ui() -> void:
	if upgrade_panel:
		upgrade_panel.visible = false

# 공격력 업그레이드 버튼 클릭
func _on_atk_upgrade_pressed() -> void:
	# 캐릭터 선택 상태 즉시 복원 (버튼 클릭으로 인한 선택 해제 방지)
	var current_character = selected_character
	if not current_character:
		# 선택된 캐릭터가 없으면 현재 선택된 슬롯에서 찾기
		if selected >= 0 and selected < slots.size() and slots[selected]["node"] != null:
			current_character = slots[selected]["node"]
			selected_character = current_character
		else:
			# 선택된 슬롯이 없으면 모든 슬롯에서 6레벨 이상 캐릭터 찾기
			for i in slots.size():
				if slots[i]["node"] != null and slots[i]["node"].level >= 6:
					current_character = slots[i]["node"]
					selected_character = current_character
					selected = i
					break
			
			if not current_character:
				return
	
	if current_character.upgrade_attack():
		# 업그레이드 성공 시 UI 업데이트
		_update_upgrade_ui(current_character)
		_update_stats_ui(current_character)  # 통계 UI도 업데이트
		# 사거리 표시기 업데이트 (공격력은 사거리에 영향 없음)
		if range_indicator and current_character:
			_draw_range_circle(current_character)

# 사거리 업그레이드 버튼 클릭
func _on_range_upgrade_pressed() -> void:
	# 캐릭터 선택 상태 즉시 복원 (버튼 클릭으로 인한 선택 해제 방지)
	var current_character = selected_character
	if not current_character:
		# 선택된 캐릭터가 없으면 현재 선택된 슬롯에서 찾기
		if selected >= 0 and selected < slots.size() and slots[selected]["node"] != null:
			current_character = slots[selected]["node"]
			selected_character = current_character
		else:
			# 선택된 슬롯이 없으면 모든 슬롯에서 6레벨 이상 캐릭터 찾기
			for i in slots.size():
				if slots[i]["node"] != null and slots[i]["node"].level >= 6:
					current_character = slots[i]["node"]
					selected_character = current_character
					selected = i
					break
			
			if not current_character:
				return
	
	if current_character.upgrade_range():
		# 업그레이드 성공 시 UI 업데이트
		_update_upgrade_ui(current_character)
		_update_stats_ui(current_character)  # 통계 UI도 업데이트
		# 사거리 표시기 업데이트
		if range_indicator and current_character:
			_draw_range_circle(current_character)

# 업그레이드 버튼 GUI 입력 이벤트 처리 (사용하지 않음 - pressed 신호만 사용)
# func _on_upgrade_button_gui_input(event: InputEvent) -> void:
#	# 마우스 이벤트를 여기서 처리하여 슬롯 선택과 충돌하지 않도록 함
#	if event is InputEventMouseButton:
#		# 마우스 버튼 이벤트를 처리했다고 표시
#		get_viewport().set_input_as_handled()
#		print("업그레이드 버튼 마우스 이벤트 소비")
#	elif event is InputEventMouseMotion:
#		# 마우스 이동 이벤트는 무시
#		pass

# 캐릭터 선택 상태 확실히 유지
func _ensure_character_selected(character: Node2D) -> void:
	if character and is_instance_valid(character):
		# 선택된 캐릭터가 여전히 유효한지 확인
		var still_exists = false
		for slot in slots:
			if slot["node"] == character:
				still_exists = true
				break
		
		if still_exists:
			# 캐릭터가 여전히 존재하면 선택 상태 유지
			selected_character = character
			# 사거리 표시기 업데이트
			if range_indicator:
				_draw_range_circle(character)
		else:
			# 캐릭터가 더 이상 존재하지 않으면 선택 해제
			deselect_character()

# 통계 UI 생성
func _create_stats_ui() -> void:
	# 통계 패널 생성
	stats_panel = Control.new()
	stats_panel.name = "StatsPanel"
	stats_panel.visible = false
	stats_panel.z_index = 5  # 슬롯보다는 뒤에, 하지만 UI는 보이도록
	stats_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE  # 마우스 이벤트 무시
	
	# UI 스타일 설정
	var style_box = StyleBoxFlat.new()
	style_box.bg_color = Color(0, 0, 0, 0.9)
	style_box.corner_radius_top_left = 10
	style_box.corner_radius_top_right = 10
	style_box.corner_radius_bottom_left = 10
	style_box.corner_radius_bottom_right = 10
	stats_panel.add_theme_stylebox_override("panel", style_box)
	
	# 패널 크기 설정
	stats_panel.custom_minimum_size = Vector2(250, 140)  # 높이 줄임
	stats_panel.position = Vector2(50, 400)  # 화면 하단에 배치하여 슬롯과 완전히 분리 (오른쪽으로 이동)
	
	# 캐릭터 이름 라벨
	stats_name_label = Label.new()
	stats_name_label.text = "캐릭터 정보"
	stats_name_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT  # 통계와 같은 왼쪽 정렬
	stats_name_label.position = Vector2(20, 5)  # 통계 라벨과 같은 x 좌표
	stats_name_label.size = Vector2(210, 25)
	
	var title_style = LabelSettings.new()
	title_style.font_size = 18
	title_style.font_color = Color.WHITE
	title_style.outline_size = 2
	title_style.outline_color = Color.BLACK
	stats_name_label.label_settings = title_style
	
	# 레벨 라벨
	stats_level_label = Label.new()
	stats_level_label.text = "레벨: 1"
	stats_level_label.position = Vector2(20, 35)  # 캐릭터 이름 바로 아래
	stats_level_label.size = Vector2(100, 20)
	
	# 공격력 라벨
	stats_atk_label = Label.new()
	stats_atk_label.text = "공격력: 0"
	stats_atk_label.position = Vector2(20, 55)  # 더 가깝게 배치
	stats_atk_label.size = Vector2(100, 20)
	
	# 사거리 라벨
	stats_range_label = Label.new()
	stats_range_label.text = "사거리: 0"
	stats_range_label.position = Vector2(20, 75)  # 더 가깝게 배치
	stats_range_label.size = Vector2(100, 20)
	
	# 공격속도 라벨
	stats_rate_label = Label.new()
	stats_rate_label.text = "공격속도: 0.0/s"
	stats_rate_label.position = Vector2(20, 95)  # 더 가깝게 배치
	stats_rate_label.size = Vector2(100, 20)
	
	# 희귀도 라벨 (역할 자리에 배치)
	stats_rarity_label = Label.new()
	stats_rarity_label.text = "희귀도: -"
	stats_rarity_label.position = Vector2(20, 115)  # 더 가깝게 배치
	stats_rarity_label.size = Vector2(200, 20)
	
	# 라벨 스타일 설정
	var label_style = LabelSettings.new()
	label_style.font_size = 14
	label_style.font_color = Color.LIGHT_GRAY
	label_style.outline_size = 1
	label_style.outline_color = Color.BLACK
	
	stats_level_label.label_settings = label_style
	stats_atk_label.label_settings = label_style
	stats_range_label.label_settings = label_style
	stats_rate_label.label_settings = label_style
	stats_rarity_label.label_settings = label_style
	
	# 패널에 라벨들 추가
	stats_panel.add_child(stats_name_label)
	stats_panel.add_child(stats_level_label)
	stats_panel.add_child(stats_atk_label)
	stats_panel.add_child(stats_range_label)
	stats_panel.add_child(stats_rate_label)
	stats_panel.add_child(stats_rarity_label)
	
	# UI를 Main의 CanvasLayer에 추가
	var main = get_node_or_null("/root/Main")
	if main:
		main.add_child(stats_panel)

# 통계 UI 업데이트
func _update_stats_ui(character: Node2D) -> void:
	if not stats_panel or not character:
		return
	
	# 캐릭터 정보 표시
	stats_panel.visible = true
	
	# 캐릭터 이름과 레벨
	var character_name = character.id.capitalize()
	stats_name_label.text = "%s (Lv.%d)" % [character_name, character.level]
	
	# 레벨 색상 적용
	var level_color = character.get_level_color()
	var name_style = stats_name_label.label_settings
	name_style.font_color = level_color
	stats_name_label.label_settings = name_style
	
	# 통계 정보 업데이트
	stats_level_label.text = "레벨: %d" % character.level
	stats_atk_label.text = "공격력: %d" % character.damage
	stats_range_label.text = "사거리: %.0f" % character.attack_range
	stats_rate_label.text = "공격속도: %.1f/s" % (1.0 / character.rate)
	
	# 캐릭터 설정 정보 가져오기
	var config = character._get_character_config()
	var rarity = config.get("rarity", "common")
	
	# 희귀도 정보 표시 (색상 변경 없이)
	var rarity_text = "희귀도: "
	match rarity:
		"common":
			rarity_text += "일반"
		"rare":
			rarity_text += "레어"
		"epic":
			rarity_text += "에픽"
		"legendary":
			rarity_text += "전설"
		_:
			rarity_text += rarity.capitalize()
	
	stats_rarity_label.text = rarity_text
	
	# 업그레이드 정보가 있으면 표시
	var upgrade_text = ""
	if character.atk_upgrades > 0:
		upgrade_text += " (+%d)" % character.atk_upgrades
	if character.range_upgrades > 0:
		upgrade_text += " (+%d)" % character.range_upgrades
	
	if upgrade_text != "":
		stats_name_label.text += upgrade_text

# 통계 UI 숨기기
func _hide_stats_ui() -> void:
	if stats_panel:
		stats_panel.visible = false

# 슬롯 상태 체크 및 UI 업데이트
func _check_slot_status_and_update_ui() -> void:
	# 선택된 캐릭터가 여전히 유효한지 확인
	if selected_character:
		# 선택된 캐릭터가 여전히 슬롯에 있는지 확인
		var still_exists = false
		for slot in slots:
			if slot["node"] == selected_character:
				still_exists = true
				break
		
		if not still_exists:
			# 선택된 캐릭터가 더 이상 존재하지 않으면 UI 숨기기
			deselect_character()
		else:
			# 캐릭터가 여전히 존재하면 통계 UI 업데이트
			_update_stats_ui(selected_character)
	
	# 빈 슬롯이 있는지 확인하여 Summon 버튼 상태 업데이트
	_update_summon_button_state()

# Summon 버튼 상태 업데이트
func _update_summon_button_state() -> void:
	var has_empty_slot = _find_empty_slot() >= 0
	
	# UI Manager의 Summon 버튼 상태 업데이트
	var ui_manager = get_node_or_null("/root/Main/UI")
	if ui_manager and ui_manager.has_method("set_summon_button_enabled"):
		ui_manager.set_summon_button_enabled(has_empty_slot)

# 초기 UI 상태 업데이트
func _update_initial_ui_state() -> void:
	# 슬롯이 제대로 설정되었는지 확인
	if slots.size() > 0:
		_update_summon_button_state()

# 사거리 업그레이드 후 모든 캐릭터의 상태 초기화
func _reset_all_characters_state_after_range_upgrade() -> void:
	"""사거리 업그레이드 후 모든 캐릭터의 상태를 초기화합니다."""
	
	for slot in slots:
		if slot["node"] and is_instance_valid(slot["node"]):
			var character = slot["node"]
			
			# 캐릭터의 공격 상태 초기화
			if character.has_method("_reset_attack_state"):
				character._reset_attack_state()
			
			# 캐릭터의 타겟 재설정
			if character.has_method("_reset_target"):
				character._reset_target()
			
			# 캐릭터의 사거리 내 적 재감지
			if character.has_method("_detect_existing_enemies"):
				character._detect_existing_enemies()
