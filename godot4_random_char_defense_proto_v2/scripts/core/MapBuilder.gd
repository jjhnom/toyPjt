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
@export var show_background := true
@export var create_slots := true
@export_range(0, 4, 1) var background_theme := 0  # 0=Spring, 1=Summer, 2=Fall, 3=Winter, 4=Ice

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
	var set := {}
	for c in loop_cells: set[c] = true
	var left := margin
	var right := cols - 1 - margin
	var top := margin
	var bottom := rows - 1 - margin
	var result: Array[Vector2i] = []
	for y in range(top+1, bottom):
		for x in range(left+1, right):
			var v := Vector2i(x,y)
			if not set.has(v): result.append(v)
	return result


func _setup_background_sprite() -> void:
	# 백그라운드 스프라이트 생성 및 설정
	var background_sprite = Sprite2D.new()
	background_sprite.name = "BackgroundSprite"
	background_sprite.z_index = -10  # 가장 뒤에 표시
	
	# 백그라운드 이미지 로드
	var background_images = [
		"res://assets/maps/background.png"
	]
	
	# 테마에 따른 이미지 선택
	if background_theme < 0 or background_theme >= background_images.size():
		background_theme = 0
	
	var selected_image = background_images[background_theme]
	var texture: Texture2D = null
	
	if ResourceLoader.exists(selected_image):
		texture = ResourceLoader.load(selected_image, "Texture2D")
	
	if texture:
		background_sprite.texture = texture
		# 맵 크기에 맞게 스케일 조정
		var map_size = Vector2(cols * tile, rows * tile)
		var texture_size = texture.get_size()
		var scale_factor = Vector2(
			map_size.x / texture_size.x,
			map_size.y / texture_size.y
		)
		background_sprite.scale = scale_factor
		# 맵 중앙에 위치
		background_sprite.position = map_size * 0.5
		print("백그라운드 설정 완료: %s (스케일: %s)" % [selected_image, scale_factor])
	else:
		# 기본 색상 배경 생성
		var default_texture = ImageTexture.new()
		var img = Image.create(cols * tile, rows * tile, false, Image.FORMAT_RGB8)
		img.fill(Color.FOREST_GREEN)
		default_texture.set_image(img)
		background_sprite.texture = default_texture
		background_sprite.position = Vector2(cols * tile * 0.5, rows * tile * 0.5)
		print("기본 백그라운드 생성 완료")
	
	# 씬에 추가
	add_child(background_sprite)

func _ready():
	print("Builder _ready() 호출됨")
	# 다른 노드들이 초기화될 때까지 잠시 대기
	call_deferred("_build_map")

func _build_map():
	print("Builder _build_map() 실행")
	
	var path2d := get_node_or_null(path2d_path) as Path2D
	var line := get_node_or_null(preview_line_path) as Line2D
	var slots_root := get_node_or_null(slots_root_path)
	
	# 백그라운드 이미지 설정
	if show_background:
		_setup_background_sprite()

	# 경로 계산
	var loop_cells := _rect_loop_cells()
	
	# Path2D 설정 (적 이동 경로)
	if path2d:
		var c := Curve2D.new()
		for p in _points_from_cells(loop_cells): c.add_point(p)
		if loop_cells.size() > 0: c.add_point(_points_from_cells([loop_cells[0]])[0])
		path2d.curve = c
		print("Path2D 설정 완료 (%d개 포인트)" % c.get_point_count())
	
	# 미리보기 라인 설정
	if line: 
		line.points = _points_from_cells(loop_cells)
		print("미리보기 라인 설정 완료")

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
