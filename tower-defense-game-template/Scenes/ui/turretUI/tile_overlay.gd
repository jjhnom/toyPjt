extends Node2D
class_name TileOverlay

var tile_size := 32
var grid_width := 0
var grid_height := 0
var overlay_tiles := {}
var valid_tile_texture: Texture2D
var invalid_tile_texture: Texture2D

func _ready():
	# 타일 텍스처 로드 (기본 색상으로 생성)
	create_tile_textures()
	
func create_tile_textures():
	# 유효한 타일 (녹색 반투명)
	valid_tile_texture = create_colored_texture(Color(0.2, 1.0, 0.2, 0.5))
	# 무효한 타일 (빨간색 반투명)
	invalid_tile_texture = create_colored_texture(Color(1.0, 0.2, 0.2, 0.5))

func create_colored_texture(color: Color) -> Texture2D:
	var image = Image.create(tile_size, tile_size, false, Image.FORMAT_RGBA8)
	image.fill(color)
	var texture = ImageTexture.new()
	texture.set_image(image)
	return texture

func setup_grid(map_size: Vector2):
	grid_width = int(map_size.x / float(tile_size)) + 1
	grid_height = int(map_size.y / float(tile_size)) + 1
	clear_overlay()

func clear_overlay():
	for tile in overlay_tiles.values():
		if is_instance_valid(tile):
			tile.queue_free()
	overlay_tiles.clear()

func update_tile_overlay(turret_position: Vector2, turret_radius: float, can_place: bool):
	clear_overlay()
	
	# 터렛 주변 타일들 업데이트
	var center_tile_x = int(turret_position.x / float(tile_size))
	var center_tile_y = int(turret_position.y / float(tile_size))
	var radius_tiles = int(turret_radius / float(tile_size)) + 1
	
	for x in range(center_tile_x - radius_tiles, center_tile_x + radius_tiles + 1):
		for y in range(center_tile_y - radius_tiles, center_tile_y + radius_tiles + 1):
			if x >= 0 and x < grid_width and y >= 0 and y < grid_height:
				var tile_pos = Vector2(x * tile_size, y * tile_size)
				var distance = turret_position.distance_to(tile_pos + Vector2(tile_size/2.0, tile_size/2.0))
				
				if distance <= turret_radius:
					create_tile(x, y, can_place)

func create_tile(x: int, y: int, is_valid: bool):
	var tile_key = str(x) + "," + str(y)
	
	# 이미 타일이 있으면 제거
	if tile_key in overlay_tiles:
		overlay_tiles[tile_key].queue_free()
	
	var sprite = Sprite2D.new()
	sprite.position = Vector2(x * tile_size, y * tile_size)
	sprite.texture = valid_tile_texture if is_valid else invalid_tile_texture
	sprite.z_index = 10  # 다른 요소들 위에 표시
	add_child(sprite)
	
	overlay_tiles[tile_key] = sprite

func show_placement_preview(turret_position: Vector2, turret_radius: float, can_place: bool):
	update_tile_overlay(turret_position, turret_radius, can_place)

func hide_overlay():
	clear_overlay()
