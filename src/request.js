export const
    getRandomDadJoke = async () => {

        // TODO: It should accept 'text/plain;, but I was not able to figure it out!
        // https://icanhazdadjoke.com/api

        const response = await fetch('https://icanhazdadjoke.com/', {
            headers: {
                Accept: 'application/json'
            },
        })

        const json = await response.json()
        return json.joke
    }