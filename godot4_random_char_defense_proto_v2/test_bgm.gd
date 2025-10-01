extends Node

func _ready():
	print("=== BGM 시스템 테스트 시작 ===")
	
	# UIManager 찾기
	var ui_manager = get_node_or_null("/root/Main/UI")
	if ui_manager:
		print("UIManager 찾음!")
		
		# BGM 관련 함수들이 있는지 확인
		if ui_manager.has_method("get_current_bgm_info"):
			print("현재 BGM: %s" % ui_manager.get_current_bgm_info())
		else:
			print("get_current_bgm_info 함수를 찾을 수 없습니다!")
		
		if ui_manager.has_method("skip_bgm"):
			print("skip_bgm 함수 사용 가능")
		else:
			print("skip_bgm 함수를 찾을 수 없습니다!")
			
		if ui_manager.has_method("toggle_bgm_random_mode"):
			print("toggle_bgm_random_mode 함수 사용 가능")
		else:
			print("toggle_bgm_random_mode 함수를 찾을 수 없습니다!")
	else:
		print("UIManager를 찾을 수 없습니다!")
	
	print("=== BGM 시스템 테스트 완료 ===")
