<script>
	import { onMount } from "svelte";
	import { Container, Row, Col } from "sveltestrap";
	import { Button } from "sveltestrap";

	import { getRandomDadJoke } from "./request";
	import DJForm from "./Component/Form.svelte";
	import DJJoke from "./Component/Joke.svelte";
	import DJTitle from "./Component/Title.svelte";

	let joke = "";
	const onRandomJoke = async () => {
		try {
			joke = await getRandomDadJoke();
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
		<DJForm />
		<DJJoke {joke} />
		<Button block on:click={onRandomJoke} color="danger">Get Next</Button>
	</Container>
</main>

<style>
	main {
		text-align: center;
	}
</style>
