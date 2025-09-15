extends Node2D

func _ready():
	# 경로 시각화
	draw_path()

func draw_path():
	# 경로 포인트들
	var path_points = [
		Vector2(1200, 360),  # 시작점 (오른쪽)
		Vector2(1000, 360),  # 첫 번째 구간
		Vector2(1000, 200),  # 위로 올라가기
		Vector2(600, 200),   # 왼쪽으로 이동
		Vector2(600, 500),   # 아래로 내려가기
		Vector2(200, 500),   # 왼쪽으로 이동
		Vector2(200, 360),   # 위로 올라가기
		Vector2(-50, 360)    # 베이스 (왼쪽 끝)
	]
	
	# 경로 라인 그리기
	for i in range(path_points.size() - 1):
		var start_point = path_points[i]
		var end_point = path_points[i + 1]
		
		# 라인 노드 생성
		var line = Line2D.new()
		line.add_point(start_point)
		line.add_point(end_point)
		line.width = 8
		line.default_color = Color(0.5, 0.3, 0.1, 0.8)  # 갈색 도로
		add_child(line)
	
	# 경로 포인트들에 마커 표시
	for i in range(path_points.size()):
		var point = path_points[i]
		var marker = ColorRect.new()
		marker.size = Vector2(12, 12)
		marker.position = point - Vector2(6, 6)
		if i == 0:
			marker.color = Color(0, 1, 0, 0.8)  # 시작점: 초록색
		elif i == path_points.size() - 1:
			marker.color = Color(1, 0, 0, 0.8)  # 끝점: 빨간색
		else:
			marker.color = Color(1, 1, 0, 0.8)  # 중간점: 노란색
		add_child(marker)
	
	print("경로 시각화 완료! 포인트 수: ", path_points.size())
