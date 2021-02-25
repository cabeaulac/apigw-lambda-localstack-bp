FROM lambci/lambda:build-python3.8
ENV LAMBDA_HOME=/usr/local/lhome 
ARG HANDLER_NAME=app
RUN mkdir -p $LAMBDA_HOME/package

WORKDIR $LAMBDA_HOME 

RUN pip install --target ./package psycopg2-binary

WORKDIR $LAMBDA_HOME/package
RUN zip -r ../${HANDLER_NAME}.zip .
WORKDIR $LAMBDA_HOME
COPY . $LAMBDA_HOME
RUN zip -gr ${HANDLER_NAME}.zip lib42
RUN zip -g ${HANDLER_NAME}.zip ${HANDLER_NAME}.py

#CMD aws lambda update-function-code --function-name mylambda --zip-file fileb://lambda.zip