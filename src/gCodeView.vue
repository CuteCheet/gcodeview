<template>
  <div class="container-fluid p-5 text-white text-center" style="background-color: rgb(34,177,76);">
    <h1>gCodeView</h1>
  </div>

  <div class="container mt-5">
    <div class="row">
      <div class="functions col-sm-4">
        <h3>Functions</h3>
        <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit...</p>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris...</p>
      </div>
      <div class="input_fields col-sm-4">
        <h3>Input Fields:</h3>
        <input v-model="input_rowss"  type="text" class="form-control" placeholder="rows" data-bs-toggle="tooltip" data-bs-placement="right" title="input_rows"/><br>
        <input v-model="input_heightt"  type="text" class="form-control" placeholder="height"  /><br>
        <input v-model="input_columnss" type="text" class="form-control"  placeholder="columns"  /><br>
        <input v-model="input_widthh" type="text" class="form-control"  placeholder="width"  /><br>
        <input v-model="input_padding_fieldss" type="text" class="form-control"  placeholder="padding_fields"  /><br>
        <input v-model="input_padding_letterss" type="text" class="form-control"  placeholder="padding_letters"  /><br>
        <input v-model="input_lpii" type="text" class="form-control"  placeholder="lpi"  /><br>
        <input v-model="input_laser_power_ww" type="text" class="form-control"  placeholder="laser_power_w"  /><br>
        <input v-model="input_laser_min_powerr" type="text" class="form-control"  placeholder="laser_min_power"  /><br>
        <input v-model="input_laser_max_powerr" type="text" class="form-control"  placeholder="laser_max_power"  /><br>
        <input v-model="input_laser_min_speedd" type="text" class="form-control"  placeholder="laser_min_speed"  /><br>
        <input v-model="input_laser_max_speedd" type="text" class="form-control"  placeholder="laser_max_speed"  /><br>
        <button class = "btn btn-success" @click="runLaser">GO</button>
      </div>
      <div class="gridResult col-sm-4">
        <h3>Output</h3>        
        <table>
          <tr v-for="i in this.grid_rows">
            <td v-for="j in this.grid_columns">
              <p>{{ this.LEs[(i-1)*this.grid_columns+this.grid_columns-j].lev().toFixed(0)}}</p></td>
          </tr>
        </table>
      <p id="cliresult"></p>
      </div>
    </div>
  </div>

  <div class="app">
        
    <div class="gridResult">
      
    </div>
    <div class="LElist">
      <h2>Laser Engagements</h2>
      <ul>
        <li v-for="(le, index) in this.LEs" :key="index">
            <span>{{ le}}</span>
            </li>
      </ul>
    </div>
    
  </div>
</template>

<script>
import {copysign, map_p, LE, Gcode, Le_field, Passes_field} from '../src/assets/js/total.js';
var laser;
var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

class Laser {
  le_list = [];
  levs = [];
  constructor(power_w = 20, p_min = 1, p_max = 100, v_min = 60, v_max = 6000) {
    this.power_w = power_w;
    this.p_min = power_w * (p_min / 100);
    this.p_max = power_w * (p_max / 100);
    this.v_min = v_min;
    this.v_max = v_max;
    this.le_list = [];
    this.levs = [];
    this.le_max = new LE(this.p_max, this.v_min);
    this.le_min = new LE(this.p_min, this.v_max);
  }

  calc_new_le(lev_new, le_old, prio_velocity = true, new_passes_count = 0) {
    var [power, velocity, passes] = le_old.get();
    let lev_old = le_old.lev();
    if (new_passes_count > 0) {
      le_old.passes = new_passes_count;
    }
    let lev_diff = Math.round(lev_new - new LE(power, velocity, passes).lev(), 3);
    
    if (new_passes_count > 0) {
      if (new_passes_count > passes) {
        lev_diff += 1;
      } else {
        lev_diff -= 1;
      }
    }
    while ((lev_diff > 0 && lev_new > lev_old) || (lev_diff < 0 && lev_new < lev_old)) {
      if (prio_velocity) {
        //power += Math.sign(lev_diff) * (this.power_w / 1000);
        power += copysign(this.power_w*1.0/1000, lev_diff);
        if (power > this.p_max) {
          power = this.p_max;
          //velocity -= Math.sign(lev_diff);
          velocity -= copysign(1,lev_diff);
          if (velocity < this.v_min) {
            return false;
          }
        }
      } else {
        //velocity += Math.sign(lev_diff);
        velocity += copysign(1,lev_diff);
        if (velocity < this.v_min) {
          velocity = this.v_min;
          //power -= Math.sign(lev_diff) * (this.power_w / 1000);
          power -= copysign(this.power_w/1000,lev_diff);
          if (power > this.p_max) {
            return false;
          }
        }
      }
      lev_diff = Math.round(lev_new - new LE(power, velocity, passes).lev(), 3);
    }

    return new LE(power.toFixed(3), velocity, passes);
  }

  add_le_value(le_old, value_to_add, prio_velocity = true) {
    const lev_new = le_old.lev() + value_to_add;
    return this.calc_new_le(lev_new, le_old, prio_velocity);
  }

  multiply_le_value(le_old, multiplicator, prio_velocity = true) {
    const lev_new = le_old.lev() * multiplicator;
    return this.calc_new_le(lev_new, le_old, prio_velocity);
  }

  newpass_le_value(le_old, multiplicator = 1, passes = 1, prio_velocity = true) {
    const lev_new = le_old.lev() * multiplicator;
    return this.calc_new_le(lev_new, le_old, prio_velocity, passes);
  }

  calc_point_power_settings(points, is_linear) {
    const lev_max = this.le_max.lev();
    const lev_min = this.le_min.lev();
    
    laser.le_list.push(this.le_min);
    laser.levs.push(lev_min);
    let factor = 0;
    if (is_linear) {
      factor = (lev_max - lev_min) / (points - 1);
    } else {
      let buffer = 0;
      while (Math.abs(lev_max - buffer) > 0.01) {
        factor += (lev_max - buffer) * 1.01 ** (-points);
        buffer = lev_min * (1 + factor) ** (points - 1);
      }
    }
    for (let pt = 1; pt < points; pt++) {
      let le_new;
      
      if (is_linear) {
        le_new = this.add_le_value(laser.le_list[0], factor * pt);
      } else {
        le_new = this.add_le_value(laser.le_list.slice(-1)[0], laser.le_list[0] * factor ** pt);
      }
      if (!le_new) {
        // throw new Error("LE cannot be reached with the given MIN/MAX values");
        // Uncomment the line above if you want to throw an exception
      }
      laser.le_list.push(le_new);
      laser.levs.push(le_new.lev());
    }
    
    this.factor = factor;
  }

  print_list() {
    for (let x = 0; x < this.le_list.length; x++) {
      //console.log("${x + 1}:\t${this.le_list[x]}");
      console.log((x+1)+"\t"+this.le_list[x]);
    }
  }
}


export default {
  name: "gCodeView",
  data() {
    return {
     
      LEs:[],
      LEVs:[],
      grid_rows:0,
      grid_columns:0,
    };
  },
  methods: {
    runLaser(){
      //alert(this.input_rows);
      //var laser;

      

      // var input_rows = Number(this.input_rowss); 
      // var input_height = Number(this.input_heightt);
      // var input_columns = Number(this.input_columnss); 
      // var input_width = Number(this.input_widthh);
      // var input_padding_fields = Number(this.input_padding_fieldss);
      // var input_padding_letters = Number(this.input_padding_letterss);
      // var input_lpi = Number(this.input_lpii);
      // var input_laser_power_w = Number(this.input_laser_power_ww);
      // var input_laser_min_power = Number(this.input_laser_min_powerr);
      // var input_laser_max_power = Number(this.input_laser_max_powerr);
      // var input_laser_min_speed = Number(this.input_laser_min_speedd);
      // var input_laser_max_speed = Number(this.input_laser_max_speedd);
      
      var input_rows = 4; 
      var input_height = 40;
      var input_columns = 6; 
      var input_width = 50;
      var input_padding_fields = 1.5;
      var input_padding_letters = 0.75;
      var input_lpi =0;
      var input_laser_power_w = 20;
      var input_laser_min_power = 100;
      var input_laser_max_power = 100;
      var input_laser_min_speed = 1800;
      var input_laser_max_speed = 1000;
      laser = new Laser(
          input_laser_power_w,
          input_laser_min_power,
          input_laser_max_power,
          input_laser_min_speed,
          input_laser_max_speed
      );
      laser.calc_point_power_settings(input_rows * input_columns, true);
      
      const le = new LE(10, 2000);const header = (laser.le_min.lev()).toFixed(0)+"-"+(laser.le_max.lev()).toFixed(0)+" "+(laser.factor < 2 ? 'F' : 'L')+(laser.factor.toFixed(1));
      console.log(
          (laser.factor < 2 ? 'F' : 'L')+ Number(laser.factor).toFixed(1) + 'x' +  (input_rows * input_columns) +  "@ LPI:" +  input_lpi +"\tLE_min: "+laser.le_min+"\t-->\tLE_max: "+laser.le_max
          
      );
      // alert(
      //   (laser.factor < 2 ? 'F' : 'L')+ Number(laser.factor).toFixed(1) + 'x' +  (input_rows * input_columns) +  "@ LPI:" +  input_lpi +"\tLE_min: "+laser.le_min+"\t-->\tLE_max: "+laser.le_max
      // );
      document.getElementById("cliresult").innerText=(laser.factor < 2 ? 'F' : 'L')+ Number(laser.factor).toFixed(1) + 'x' +  (input_rows * input_columns) +  "@ LPI:" +  input_lpi +"\nLE_min: "+laser.le_min+"\t-->\nLE_max: "+laser.le_max;
      let height = input_height;
      let width = input_width;
      const tf = new Le_field(
          laser.le_list, input_rows, input_columns, height, width, input_padding_fields
      );
      let colwidth, rowheight;
      width, height, colwidth, rowheight = tf.make_le_field(input_lpi);
      colwidth = Math.min(
          rowheight / 2,
          (width - (header.length - 1) * input_padding_letters) / header.length
      );
      const gc = new Gcode(le, rowheight, colwidth, input_padding_letters);

      this.LEs = laser.le_list;
      this.LEVs = laser.levs;

      console.log(this.LEs);
      this.grid_rows = input_rows;
      this.grid_columns = input_columns;

    },
  }, 
  computed: {
  },
  mounted() {
  },
  };
</script>

<style scoped>

</style>
