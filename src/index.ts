require('dotenv').config();
const fs = require('fs');
const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
import * as awsx from "@pulumi/awsx";
import * as random from "@pulumi/random";
import {AwsUtil} from "./util/aws-util"
import {PulumiUtil} from "./util/pulumi-util";


let stackPieces: string[] = pulumi.getStack().split('.');

export * from "./db-secrets";
export * from "./hello/helloApi";
export * from "./profile/profileApi";
