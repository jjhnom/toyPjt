extends Node

# ===== Board Config =====
@export var cols := 8
@export var rows := 8
@export var tile := 90
@export var margin := 1
@export var random_seed := 1

# ===== Node Paths =====
@export var path2d_path: NodePath = ^"../Path2D"
@export var preview_line_path: NodePath = ^"../PathPreview"
@export var slots_root_path: NodePath = ^"../Slots"

# ===== Map Options =====
@export var create_slots := true

func _rect_loop_cells() -> Array[Vector2i]:
	var left := margin
	var right := cols - 1 - margin
	var top := margin
	var bottom := rows - 1 - margin
	var cells: Array[Vector2i] = []
	if left >= right or top >= bottom:
		return cells
	for x in range(left, right+1): cells.append(Vector2i(x, top))
	for y in range(top+1, bottom+1): cells.append(Vector2i(right, y))
	for x in range(right-1, left-1, -1): cells.append(Vector2i(x, bottom))
	for y in range(bottom-1, top, -1): cells.append(Vector2i(left, y))
	return cells

func _points_from_cells(cells: Array[Vector2i]) -> PackedVector2Array:
	var pts := PackedVector2Array()
	for c in cells: pts.append(Vector2((c.x+0.5)*tile, (c.y+0.5)*tile))
	return pts

func _interior_cells(loop_cells: Array[Vector2i]) -> Array[Vector2i]:
	var cell_set := {}
	for c in loop_cells: cell_set[c] = true
	var left := margin
	var right := cols - 1 - margin
	var top := margin
	var bottom := rows - 1 - margin
	var result: Array[Vector2i] = []
	for y in range(top+1, bottom):
		for x in range(left+1, right):
			var v := Vector2i(x,y)
			if not cell_set.has(v): result.append(v)
	return result




func _ready():
	print("Builder _ready() 호출됨")
	# 다른 노드들이 초기화될 때까지 잠시 대기
	call_deferred("_build_map")

func _build_map():
	print("Builder _build_map() 실행")
	
	var path2d := get_node_or_null(path2d_path) as Path2D
	var line := get_node_or_null(preview_line_path) as Line2D
	var slots_root := get_node_or_null(slots_root_path)
	

	# 경로 계산
	var loop_cells := _rect_loop_cells()
	
	# Path2D 설정 (적 이동 경로)
	if path2d:
		var c := Curve2D.new()
		for p in _points_from_cells(loop_cells): c.add_point(p)
		if loop_cells.size() > 0: c.add_point(_points_from_cells([loop_cells[0]])[0])
		path2d.curve = c
		print("Path2D 설정 완료 (%d개 포인트)" % c.get_point_count())
	
	# 미리보기 라인 설정 (적 이동 경로 표시)
	if line: 
		line.points = _points_from_cells(loop_cells)
		# 라인 시각적 속성 설정
		line.default_color = Color.RED
		line.width = 8.0
		line.z_index = 5  # 다른 요소들 위에 표시
		line.visible = false  # 강제로 보이게 설정
		print("미리보기 라인 설정 완료 (빨간색, 두께: %f, visible: %s)" % [line.width, line.visible])

	# 슬롯 생성 (캐릭터 배치 영역)
	if create_slots and slots_root:
		for child in slots_root.get_children(): child.queue_free()
		var interior_cells = _interior_cells(loop_cells)
		var slot_count = 0
		for v in interior_cells:
			var a := Area2D.new()
			a.name = "Slot_%d_%d" % [v.x, v.y]
			a.position = Vector2((v.x+0.5)*tile, (v.y+0.5)*tile)
			var cs := CollisionShape2D.new()
			var shp := RectangleShape2D.new()
			shp.size = Vector2(tile*0.9, tile*0.9)
			cs.shape = shp
			a.add_child(cs)
			slots_root.add_child(a)
			slot_count += 1
		print("슬롯 %d개 생성 완료" % slot_count)
	
	print("맵 빌드 완료")
