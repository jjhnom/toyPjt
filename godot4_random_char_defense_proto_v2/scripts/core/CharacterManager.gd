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
			print("WARNING: CharacterLayer를 찾을 수 없습니다")
			return
	
	_setup_slots()
	_create_range_indicator()

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
				print("WARNING: Map 노드를 찾을 수 없습니다")
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
	
	print("캐릭터 판매: %s (레벨 %d) - %d골드 획득" % [character.id, character.level, sell_price])
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
		print("소환 실패: 빈 슬롯이 없습니다!")
		return
	
	# 빈 슬롯이 있으면 골드 차감
	if not gm.spend_gold(cost): 
		print("소환 실패: 골드가 부족합니다!")
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
	tween.tween_callback(func(): print("Summon effect completed - Final scale: ", character.scale))
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
	
	print("캐릭터 위치 교체: %s (%d슬롯) ↔ %s (%d슬롯)" % [
		dragging_char.id, to_slot, target_char.id, from_slot
	])
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
	range_indicator.set_character_range(character.range)
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
		print("캐릭터 선택됨: %s (사거리: %.1f)" % [character.id, character.range])

# 캐릭터 선택 해제
func deselect_character() -> void:
	if selected_character:
		print("캐릭터 선택 해제됨: %s" % selected_character.id)
	
	selected_character = null
	selected = -1  # 인덱스도 리셋
	_hide_range_indicator()

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
	tween.tween_callback(func(): print("Merge effect completed"))
