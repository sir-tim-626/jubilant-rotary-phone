<script>
	import { onMount } from "svelte";
	import { Container, Row, Col } from "sveltestrap";
	import { Button } from "sveltestrap";

	import { getRandomDadJoke, searchJokes } from "./request";
	import DJForm from "./Component/Form.svelte";
	import DJJoke from "./Component/Joke.svelte";
	import DJTitle from "./Component/Title.svelte";

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
		<!-- debugging! {mode} -->
		{#if mode === "random"}
			<DJJoke {joke} />
		{/if}
		{#if mode === "search"}
			{#each foundJokes as jokeObj}
				<DJJoke joke={jokeObj.joke} />
			{:else}
				<p>I don't have any jokes for #{term}</p>
			{/each}
		{/if}
		<Button block on:click={onRandomJoke} color="danger">
			Get Another
		</Button>
	</Container>
</main>

<style>
	main {
		text-align: center;
	}
</style>
