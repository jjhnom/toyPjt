extends Node2D

@export var show_fill := true
@export var show_outline := true
@export var fill_color : Color = Color(0.2, 0.8, 1.0, 0.20)
@export var outline_color : Color = Color(0.2, 0.8, 1.0, 0.9)
@export var outline_px : float = 1.0
@export var use_collision_shapes := true
@export var default_size := Vector2(90 * 0.8, 90 * 0.8)
@export var only_in_editor := false
@export var target_slots_path: NodePath = NodePath("Slots")

var _hover: Area2D = null
var _slots_node: Node2D = null

func _ready() -> void:
	visible = Engine.is_editor_hint() if only_in_editor else true
	
	# 먼저 기본 경로에서 찾기
	_slots_node = get_node_or_null(target_slots_path)
	
	# 기본 경로에서 찾지 못하면 다른 경로들 시도
	if not _slots_node:
		var alternative_paths = ["../Slots", "../../Slots", "../Map/Slots", "../../Map/Slots"]
		for path in alternative_paths:
			_slots_node = get_node_or_null(NodePath(path))
			if _slots_node:
				break
	
	if _slots_node:
		# 신호 연결 전에 노드가 유효한지 확인
		if is_instance_valid(_slots_node):
			_slots_node.child_entered_tree.connect(_on_children_changed)
			_slots_node.child_exiting_tree.connect(_on_children_changed)
			# 지연 실행으로 Builder가 슬롯을 생성한 후에 연결
			call_deferred("_wire_all_slots")
			call_deferred("queue_redraw")

func _on_children_changed(_n: Node) -> void:
	# get_tree()가 null인지 확인 (노드가 씬에서 제거된 경우)
	if not get_tree():
		return
	await get_tree().process_frame
	_wire_all_slots()
	queue_redraw()

func _wire_all_slots() -> void:
	if not _slots_node or not is_instance_valid(_slots_node):
		return
	
	var children = _slots_node.get_children()
	
	for a in children:
		if a is Area2D and not a.has_meta("hover_wired"):
			# 마우스 호버만 감지하고 입력은 차단하지 않음
			a.input_pickable = true
			a.mouse_entered.connect(func():
				_hover = a
				queue_redraw()
			)
			a.mouse_exited.connect(func():
				if _hover == a:
					_hover = null
				queue_redraw()
			)
			a.set_meta("hover_wired", true)

func _draw() -> void:
	if not _slots_node or not is_instance_valid(_slots_node):
		return
		
	var children = _slots_node.get_children()
	
	# 슬롯 채우기/테두리
	for a in children:
		if a is Area2D:
			var pos = (a as Node2D).position
			var sz := default_size
			var cs := a.get_node_or_null("CollisionShape2D")
			if use_collision_shapes and cs and cs.shape is RectangleShape2D:
				sz = cs.shape.size
			
			# SlotOverlay와 Slots가 같은 부모를 가지므로 직접 position 사용
			var top_left: Vector2 = pos - sz * 0.5
			var rect := Rect2(top_left, sz)
			
			if show_fill:
				draw_rect(rect, fill_color, true)
			if show_outline:
				draw_rect(rect, outline_color, false, outline_px)

	# 마우스 오버 하이라이트
	if _hover:
		var sz := default_size
		var cs := _hover.get_node_or_null("CollisionShape2D")
		if use_collision_shapes and cs and cs.shape is RectangleShape2D:
			sz = cs.shape.size
		var hover_top_left: Vector2 = (_hover as Node2D).position - sz * 0.5
		var rect := Rect2(hover_top_left, sz)
		draw_rect(rect, Color(1,1,0,0.25), true)
