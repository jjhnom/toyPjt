extends Node
@export var tilemap_ground: TileMap
@export var tilemap_path: TileMap
@export var tower_scene: PackedScene
@export var cell_size: Vector2i = Vector2i(32, 32)

var occupied := {}            # {Vector2i: true}
var placing := true
var hover_cell: Vector2i

func _ready():
    set_process(true)
    set_process_unhandled_input(true)

func _process(_delta):
    if not placing: return
    var world_pos = get_viewport().get_mouse_position()
    var cell = _world_to_cell(world_pos)
    if cell != hover_cell:
        hover_cell = cell
        update()

func _draw():
    if not placing: return
    var ok = _can_place(hover_cell)
    var color = ok ? Color(0,1,0,0.35) : Color(1,0,0,0.35)
    var local = tilemap_ground.map_to_local(hover_cell)
    var top_left = local - Vector2(cell_size) / 2.0
    draw_rect(Rect2(top_left, Vector2(cell_size)), color, true)
    draw_rect(Rect2(top_left, Vector2(cell_size)), Color(1,1,1,0.9), false, 1.0)

func _unhandled_input(event):
    if not placing: return
    if event is InputEventMouseButton and event.pressed:
        if event.button_index == MOUSE_BUTTON_LEFT:
            _try_place(hover_cell)
        elif event.button_index == MOUSE_BUTTON_RIGHT:
            placing = false
            update()

func _try_place(cell: Vector2i) -> bool:
    if not _can_place(cell): return false
    var tower := tower_scene.instantiate()
    tower.position = tilemap_ground.map_to_local(cell)
    tower.set_meta("grid_cell", cell)
    tower.connect("tree_exited", Callable(self, "_on_tower_removed").bind(cell))
    get_tree().current_scene.add_child(tower)
    occupied[cell] = true
    return true

func _can_place(cell: Vector2i) -> bool:
    if not tilemap_ground.get_used_rect().has_point(cell): return false
    var on_path := tilemap_path.get_cell_source_id(0, cell) != -1
    if on_path: return false
    if occupied.has(cell): return false
    return true

func _on_tower_removed(cell: Vector2i): occupied.erase(cell)

func _world_to_cell(world_pos: Vector2) -> Vector2i:
    var local = tilemap_ground.to_local(world_pos)
    return tilemap_ground.local_to_map(local)
