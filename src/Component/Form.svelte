<script>
    import { Col, Row } from "sveltestrap";
    import { Form, FormGroup, FormText, Input, Label } from "sveltestrap";
    import { Button } from "sveltestrap";
</script>

<!-- The Form/FormGroup must contain the Row -->
<!-- But why ? -->
<Form>
    <FormGroup>
        <Row>
            <Col md="1" xs="2">
                <Label for="searchField">Search</Label>
            </Col>
            <Col md="7" xs="10">
                <Input
                    type="text"
                    id="searchField"
                    placeholder="your favorite Joke"
                />
            </Col>
            <Col md="4">
                <Button block color="success">Search</Button>
            </Col>
        </Row>
    </FormGroup>
</Form>
