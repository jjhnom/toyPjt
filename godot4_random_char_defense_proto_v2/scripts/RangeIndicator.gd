extends Node2D
class_name RangeIndicator

var range_radius: float = 0.0

func set_character_range(radius: float) -> void:
	range_radius = radius
	queue_redraw()

func _draw() -> void:
	if range_radius <= 0:
		return
	
	var circle_color = Color(0.5, 1.0, 0.5, 0.2)  # 반투명 녹색
	var outline_color = Color(0.3, 0.8, 0.3, 0.7)  # 진한 녹색 테두리
	
	# 원 그리기
	draw_circle(Vector2.ZERO, range_radius, circle_color)
	draw_arc(Vector2.ZERO, range_radius, 0, TAU, 64, outline_color, 2.0)
