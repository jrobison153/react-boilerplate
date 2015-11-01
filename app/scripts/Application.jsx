/**
 * Created by jrobison on 4/25/2015.
 */

"use strict";

var React = require("react");

class Application extends React.Component {

    render() {
        return <div className="application">

            <div id='wrapper'></div>
            </div>;
    }
}

React.render(<Application/>, document.getElementById("app"));

