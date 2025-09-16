extends Camera2D

@onready var bg: Sprite2D = $"../Background"

func _ready() -> void:
	enabled = true
	if bg == null or bg.texture == null:
		return

	# 배경 실제 픽셀 크기(스케일, 좌표계 반영)
	var bg_size: Vector2 = bg.texture.get_size() * bg.scale
	var bg_origin: Vector2 = bg.position  # centered=false 이므로 좌상단이 원점

	# 현재 뷰포트 크기
	var vp: Vector2 = get_viewport().get_visible_rect().size

	# 전체가 보이도록 맞춤 (더 큰 비율을 줌으로 사용)
	# Godot의 Camera2D.zoom은 값이 커질수록 "멀리" 보입니다.
	var fit: float = max(bg_size.x / vp.x, bg_size.y / vp.y)
	# 가로형 화면에 맞게 줌 조정 (6:5 비율 최적화)
	zoom = Vector2(fit * 0.9, fit * 0.9)

	# 배경의 중앙을 카메라 중심으로
	position = bg_origin + bg_size * 0.5

	# 흔들림/스냅 방지 (선택)
	limit_smoothed = true
