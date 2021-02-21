<script>
	import { onMount } from "svelte";
	import { Container, Row, Col } from "sveltestrap";

	import { getRandomDadJoke } from "./request";
	import DJForm from "./Component/Form.svelte";
	import DJJoke from "./Component/Joke.svelte";
	import DJTitle from "./Component/Title.svelte";

	let joke = "";
	onMount(async () => {
		joke = await getRandomDadJoke();
	});
</script>

<main>

<Container>
	<DJTitle />
	<DJForm />
	<DJJoke {joke} />
</Container>
</main>

<style>
	main {
		text-align: center;
	}
</style>
