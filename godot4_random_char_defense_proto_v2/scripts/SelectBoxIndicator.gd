extends Node2D
class_name SelectBoxIndicator

var select_box_texture: Texture2D
var character_size: Vector2 = Vector2(64, 64)  # 기본 캐릭터 크기
var animation_time: float = 0.0
var pulse_speed: float = 2.0  # 맥박 속도

# 이미지 프레임 정보
var frame_width: int = 64  # 각 프레임의 너비
var frame_height: int = 64  # 각 프레임의 높이
var total_frames: int = 3  # 총 프레임 수
var current_frame: int = 0  # 현재 사용할 프레임

func _ready():
	# selectBox.png 텍스처 로드
	select_box_texture = load("res://assets/etc/selectBox.png")
	if not select_box_texture:
		print("경고: selectBox.png를 로드할 수 없습니다")
	else:
		var texture_size = select_box_texture.get_size()
		print("selectBox.png 로드 성공 - 전체 크기: %s" % texture_size)
		
		# 이미지 크기를 기반으로 프레임 정보 자동 계산
		_calculate_frame_info(texture_size)

func _process(delta: float):
	# 맥박 애니메이션을 위한 시간 업데이트
	animation_time += delta
	if visible:
		queue_redraw()

func _calculate_frame_info(texture_size: Vector2):
	# selectBox.png는 3개의 프레임이 가로로 배열되어 있다고 가정
	# 1024x1024라면 실제로는 3개 프레임이 가로로 배치된 것일 수 있음
	
	# 3개 프레임으로 가정하고 계산
	total_frames = 3
	
	# 가로/세로 비율을 확인하여 배열 방향 결정
	var aspect_ratio = texture_size.x / texture_size.y
	
	if aspect_ratio > 2.0:
		# 가로로 3개 배열된 경우 (예: 1024x341 또는 192x64)
		frame_height = int(texture_size.y)
		frame_width = int(texture_size.x / total_frames)
		print("SelectBox: 가로 배열 감지 - 전체크기: %s, 각프레임: %dx%d" % [texture_size, frame_width, frame_height])
	elif aspect_ratio < 0.5:
		# 세로로 3개 배열된 경우 (예: 64x192)
		frame_width = int(texture_size.x)
		frame_height = int(texture_size.y / total_frames)
		print("SelectBox: 세로 배열 감지 - 전체크기: %s, 각프레임: %dx%d" % [texture_size, frame_width, frame_height])
	else:
		# 정사각형인 경우, 3개가 가로로 배열되었다고 가정
		frame_height = int(texture_size.y)
		frame_width = int(texture_size.x / total_frames)
		print("SelectBox: 정사각형 이미지 - 3개 가로 배열 가정, 각프레임: %dx%d" % [frame_width, frame_height])
	
	print("SelectBox 프레임 정보: %dx%d, 총 %d프레임" % [frame_width, frame_height, total_frames])

func set_character_size(size: Vector2):
	character_size = size
	print("SelectBoxIndicator: 캐릭터 크기 설정 - %s" % size)
	queue_redraw()

func set_frame(frame_index: int):
	current_frame = clamp(frame_index, 0, total_frames - 1)
	print("SelectBoxIndicator: 프레임 설정 - %d/%d" % [current_frame, total_frames - 1])
	queue_redraw()

func _draw():
	if not select_box_texture:
		return
	
	# 맥박 효과 계산 (1.0 ~ 1.1 사이로 크기 변화)
	var pulse_factor = 1.0 + sin(animation_time * pulse_speed) * 0.05
	
	# 현재 프레임의 영역 계산
	var source_rect = Rect2()
	if frame_width > 0 and frame_height > 0:
		var frames_per_row = int(select_box_texture.get_width() / frame_width)
		var frame_x = (current_frame % frames_per_row) * frame_width
		var frame_y = (current_frame / frames_per_row) * frame_height
		source_rect = Rect2(frame_x, frame_y, frame_width, frame_height)
		print("SelectBox 그리기: 프레임 %d, 영역 %s" % [current_frame, source_rect])
	else:
		source_rect = Rect2(0, 0, select_box_texture.get_width(), select_box_texture.get_height())
	
	# selectBox를 캐릭터 크기에 맞게 조정하여 그리기
	var base_scale = max(character_size.x / frame_width, character_size.y / frame_height) * 1.3  # 1.3배 크게
	var final_scale = base_scale * pulse_factor
	var scaled_size = Vector2(frame_width, frame_height) * final_scale
	
	# 중앙 정렬을 위한 위치 계산
	var draw_position = -scaled_size / 2
	
	# AtlasTexture를 사용하여 특정 프레임만 그리기
	var atlas_texture = AtlasTexture.new()
	atlas_texture.atlas = select_box_texture
	atlas_texture.region = source_rect
	
	# 디버그: AtlasTexture 정보 출력
	print("AtlasTexture - Atlas: %s, Region: %s" % [atlas_texture.atlas.get_size(), atlas_texture.region])
	
	# selectBox 이미지 그리기 (약간 투명하게)
	var modulate_color = Color(1, 1, 1, 0.9)  # 90% 불투명도
	draw_texture_rect(atlas_texture, Rect2(draw_position, scaled_size), false, modulate_color)
