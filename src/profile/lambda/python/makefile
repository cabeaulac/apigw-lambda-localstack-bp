.PHONY:get_profile_by_id
.PHONY: build

FILENAME := $(basename $(wildcard *.py))
GET_PROFILE_BY_ID_FILENAME=get_profile_by_id

build: get_profile_by_id

get_profile_by_id:
	rm -rf build
	mkdir -p build
	docker build  --build-arg HANDLER_NAME=$(GET_PROFILE_BY_ID_FILENAME) -t $(GET_PROFILE_BY_ID_FILENAME)-lambda .	
	docker create -ti --name $(GET_PROFILE_BY_ID_FILENAME)-lambda-cont $(GET_PROFILE_BY_ID_FILENAME)-lambda bash
	docker cp $(GET_PROFILE_BY_ID_FILENAME)-lambda-cont:/usr/local/lhome/$(GET_PROFILE_BY_ID_FILENAME).zip ./build
	docker rm -f $(GET_PROFILE_BY_ID_FILENAME)-lambda-cont

run: compress
	@aws-okta exec sandbox -- sam local invoke "${FILENAME}" -e event.json
