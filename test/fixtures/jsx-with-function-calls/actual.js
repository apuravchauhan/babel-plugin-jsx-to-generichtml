
import {Component } from 'preact';

export default class Home extends Component {
  
    a() {
    return  <div>hello! {this.b()}</div>
    }

    b() {
        return <p> {3+5} I am done</p>
    }
   
    render() { 
    return (
        <div>
       Hey??  {this.a()}
        </div>
    );
  }
}
