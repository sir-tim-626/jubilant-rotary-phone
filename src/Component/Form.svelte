<script>
    import { createEventDispatcher } from "svelte";

    import { Col, Row } from "sveltestrap";
    import { Form, FormGroup, FormText, Input, Label } from "sveltestrap";
    import { Button } from "sveltestrap";

    const dispatch = createEventDispatcher();
    let term = "";
    $: notReady = term.length < 5;

    const onSearch = (e) => {
        e.preventDefault();
        if (!notReady) {
            dispatch("search", term);
        }
    };
</script>

<!-- The Form/FormGroup must contain the Row -->
<!-- But why ? -->
<Form on:submit={onSearch}>
    <FormGroup>
        <Row>
            <Col md="1" xs="2">
                <Label for="searchField">Term</Label>
            </Col>
            <Col md="7" xs="10">
                <Input
                    bind:value={term}
                    type="text"
                    id="searchField"
                    placeholder="your favorite Joke"
                />
            </Col>
            <Col md="4">
                <Button disabled={notReady} type="submit" block color="success">
                    Search
                </Button>
            </Col>
        </Row>
    </FormGroup>
</Form>

<!-- 
    add not-allowed cursor on the Button if notReady
    but is already disabled.
 -->
