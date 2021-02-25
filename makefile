SHELL := /bin/bash
SUBDIRS := $(dir $(wildcard **/makefile)) ./src/profile/lambda/python

.PHONY:all setup deploy-impl destroy up down clean stop-all remove-all post lambda-log lambda-log-get deploy reset
.PHONY: build $(SUBDIRS)

ifneq (,$(wildcard ./.env))
include .env
endif
mkfile_path := $(abspath $(lastword $(MAKEFILE_LIST)))
CURRENT_DIR := $(notdir $(patsubst %/,%,$(dir $(mkfile_path))))
PROFILE_ENDPOINT=$(shell pulumi stack output profileApiEndpoint)
CREATE_PROFILE_LAMBDA_NAME=$(shell pulumi stack output createProfileLambdaId)
GET_PROFILE_PYTHON_LAMBDA_NAME=$(shell pulumi stack output getProfilePythonLambdaId)


all: setup build

redo: reset cleanup setup up
cleanup: down clean
deploy: build deploy-impl

setup:
	@if not [ "$(hash brew)" 2>/dev/null ]; then \
		/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"; \
	fi

	@if not [ "$(hash pulumi)" 2>/dev/null ]; then \
		brew install pulumi; \
	fi

	@if [ ! -d "node_modules" ]; then \
		npm config set loglevel warn; \
		npm install; \
	fi

	@docker pull localstack/localstack:$(LS_VERSION);

	pulumi stack init $(STACK) || pulumi stack select $(STACK)

	pulumi config set aws:region $(REGION);

build: $(SUBDIRS)
$(SUBDIRS):
	@$(MAKE) -C $@ build

reset:
	rm -rf .pulumi

deploy-impl:
	pulumi up -y -s $(STACK);


destroy:
	-pulumi destroy -y -s $(STACK)

	-pulumi stack rm -f -y -s $(STACK)

up:
	TMPDIR=/private$(TMPDIR); CURRENT_DIR=$(CURRENT_DIR) docker-compose up -d 

down:
	TMPDIR=/private$(TMPDIR); CURRENT_DIR=$(CURRENT_DIR)  docker-compose down

clean:
	docker system prune -f;
	docker-compose down --volumes

stop-all:
	docker stop $(docker ps -aq);

remove-all:
	docker rm $(docker ps -aq);

post:
	 curl -v -d '{"email":"chad@domain.com", "first_name":"Chad", "last_name":"Beaulac"}' -H "Content-Type: application/json" -X POST "$(PROFILE_ENDPOINT)profile"

lambda-log:
	aws --endpoint-url=http://localhost:4566 logs tail /aws/lambda/$(CREATE_PROFILE_LAMBDA_NAME) --follow

lambda-log-get:
	aws --endpoint-url=http://localhost:4566 logs tail /aws/lambda/$(GET_PROFILE_PYTHON_LAMBDA_NAME) --follow

