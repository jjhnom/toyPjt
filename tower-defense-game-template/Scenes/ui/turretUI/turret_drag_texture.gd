extends TextureRect

var turretType := ""

var can_grab = false
var grabbed_offset = Vector2()
var initial_pos := position
var placeholder = null
<<<<<<< HEAD
=======
var tile_overlay = null
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd

func _ready():
	Globals.goldChanged.connect(check_can_purchase)

func _gui_input(event):
	if event is InputEventMouseButton and check_can_purchase(Globals.currentMap.gold):
		can_grab = event.pressed
		grabbed_offset = position - get_global_mouse_position()

func _process(_delta):
	if Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and can_grab:
		if placeholder:
<<<<<<< HEAD
			placeholder.position = get_global_mouse_position() - get_viewport_rect().size / 2
=======
			# 마우스 위치를 맵 좌표계로 변환
			var mouse_pos = get_global_mouse_position()
			var camera = get_viewport().get_camera_2d()
			if camera:
				# 카메라 위치와 줌을 고려한 정확한 좌표 변환
				var viewport_size = get_viewport().get_visible_rect().size
				var mouse_local = (mouse_pos - viewport_size / 2) / camera.zoom + camera.position
				placeholder.position = mouse_local
			else:
				placeholder.position = mouse_pos
			update_tile_overlay()
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd
		else:
			position = get_global_mouse_position() + grabbed_offset
	if Input.is_action_just_released("LeftClick") and placeholder:
		check_can_drop()

func _get_drag_data(_at_position):
	if check_can_purchase(Globals.currentMap.gold):
		visible = false
		create_placeholder()

func check_can_drop():
	position = initial_pos
	can_grab = false
	visible = true
<<<<<<< HEAD
=======
	hide_tile_overlay()
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd
	if placeholder.can_place:
		build()
		placeholder = null
		return
	failed_drop()

func build():
	Globals.currentMap.gold -= Data.turrets[turretType]["cost"]
	placeholder.build()

func failed_drop():
	if placeholder:
		placeholder.queue_free()
		placeholder = null
<<<<<<< HEAD
=======
	hide_tile_overlay()
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd

func create_placeholder():
	var turretScene := load(Data.turrets[turretType]["scene"])
	var turret = turretScene.instantiate()
	turret.turret_type = turretType
	Globals.turretsNode.add_child(turret)
	placeholder = turret
	placeholder.set_placeholder()
<<<<<<< HEAD
=======
	
	# 타일 오버레이 생성
	create_tile_overlay()
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd

func check_can_purchase(newGold):
	if turretType:
		if newGold >= Data.turrets[turretType]["cost"]:
			get_parent().can_purchase = true
			return true
		get_parent().can_purchase = false
		return false
<<<<<<< HEAD
=======

func create_tile_overlay():
	if not tile_overlay:
		var overlay_scene = preload("res://Scenes/ui/turretUI/tile_overlay.tscn")
		tile_overlay = overlay_scene.instantiate()
		Globals.currentMap.add_child(tile_overlay)
		
		# 맵 크기를 동적으로 가져오기
		var map_size = get_viewport().get_visible_rect().size
		tile_overlay.setup_grid(map_size)
		print("Tile overlay created with map size: ", map_size)

func update_tile_overlay():
	if placeholder and tile_overlay:
		# 실제 터렛의 CollisionArea 반지름 사용
		var turret_radius = 22.8  # turretBase.tscn의 CollisionShape2D 반지름
		tile_overlay.show_placement_preview(placeholder.position, turret_radius, placeholder.can_place)
		print("Updating tile overlay at position: ", placeholder.position, " can_place: ", placeholder.can_place)

func hide_tile_overlay():
	if tile_overlay:
		tile_overlay.hide_overlay()
>>>>>>> 738a78b3e1d993b7597c88e2346f98da02a097fd
