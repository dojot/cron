#!/bin/bash -ex
if [ $TRAVIS_PULL_REQUEST == false ] ; then
  version="latest"
  if [ $TRAVIS_BRANCH != "master" ] ; then
    version=$TRAVIS_BRANCH
  fi

  DOCKER_TAG=$(echo ${version} | sed 's/\(.*\)\/\(.*\)/\1_\2/')

  tag=${TRAVIS_REPO_SLUG}:${DOCKER_TAG}

  docker login -u="${DOCKER_USERNAME}" -p="${DOCKER_PASSWORD}"
  docker tag ${TRAVIS_REPO_SLUG} ${tag}
  docker push $tag
fi
