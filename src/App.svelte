<script>
	import { onMount } from "svelte";
	import { Container, Row, Col } from "sveltestrap";
	import { Button } from "sveltestrap";

	import { getRandomDadJoke, searchJokes } from "./request";
	import DJForm from "./Component/Form.svelte";
	import DJJoke from "./Component/Joke.svelte";
	import DJTitle from "./Component/Title.svelte";
	import Transition from "./Component/Transition.svelte";

	// mode goes to "loading" during each request.
	// that way, the display is cleared until the reqeust has arrived.

	let mode = "loading";
	let joke = "";
	let foundJokes = [];
	let term = "";

	const onRandomJoke = async () => {
		mode = "loading";
		try {
			joke = await getRandomDadJoke();
			mode = "random";
		} catch (e) {
			alert("There was an error!");
		}
	};

	const onSearch = async (e) => {
		mode = "loading";
		term = e.detail;
		try {
			foundJokes = await searchJokes(term);
			// want to erase the search input ... but also erases the error message.
			// term = ''
			mode = "search";
		} catch (e) {
			alert("There was an error!");
		}
	};

	onMount(async () => {
		onRandomJoke();
	});
</script>

<main>
	<Container>
		<DJTitle />
		<DJForm on:search={onSearch} />
		<Button block on:click={onRandomJoke} color="danger">
			Get Another Random Joke
		</Button>
		<!-- debugging! {mode} -->
		{#if mode === "random"}
			<Transition>
				<DJJoke {joke} />
			</Transition>
		{/if}
		{#if mode === "search"}
			<Transition>
				{#each foundJokes as jokeObj}
					<DJJoke joke={jokeObj.joke} />
				{:else}
					<p>I don't have any jokes for #{term}</p>
				{/each}
			</Transition>
		{/if}
	</Container>
</main>

<style>
	main {
		text-align: center;
	}
</style>
