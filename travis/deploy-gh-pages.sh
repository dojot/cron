if [ $TRAVIS_PULL_REQUEST == false ] ; then
    git remote add -f origin-gh-pages https://github.com/${TRAVIS_REPO_SLUG}
    git fetch origin-gh-pages
    git checkout . 
    git checkout -b temp-pages origin-gh-pages/gh-pages -f
    git checkout origin-gh-pages/${TRAVIS_BRANCH} -- ./docs
    rm -fr ./_static
    mv docs/* . -f
    git rm -r docs


    if [ "${TRAVIS_BRANCH}" == "master" ]
    then
    export VERSION="latest"
    else
    export VERSION="${TRAVIS_BRANCH}"
    fi

    docker run --volume $(pwd):/temp:Z dojot/aglio -i /temp/api.apib -o - > ./apiary_${VERSION}.html

    git add apiary_${VERSION}.html
    git commit -m 'Updating gh-pages' 
    git push --force http://${GITHUB_TOKEN}:x-oauth-basic@github.com/${TRAVIS_REPO_SLUG} temp-pages:gh-pages

    git checkout . 
    git clean -fd
    git checkout ${TRAVIS_BRANCH} origin-gh-pages/${TRAVIS_BRANCH} 
fi
