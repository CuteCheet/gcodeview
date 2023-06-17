// Import statements are not required in JavaScript

// Function to calculate the copysign of a number
export function copysign(x, y) {
    return Math.abs(x) * (y >= 0 ? 1 : -1);
}
export function map_p(laser_power, g_code_factor = 1000, max_laser_power = 20) {
  return (g_code_factor * laser_power) / max_laser_power;
}

export class LE {
  constructor(power, velocity, passes = 1) {
    this.power = power;
    this.velocity = velocity;
    this.passes = passes;
  }

  unit_factor = 1000 * 60;

  lev() {
    return this.passes * this.unit_factor * this.power / this.velocity;
  }

  get() {
    return [this.power, this.velocity, this.passes];
  }

  toString() {
    //return "power: ${this.power.toFixed(2)}\tvelocity: ${this.velocity.toFixed(1)}\tpasses: ${this.passes.toFixed(0)}\tLEV: ${this.lev().toFixed(0)}";
    return "power: "+Number(this.power).toFixed(2)+"\tvelocity: "+Number(this.velocity).toFixed(1)+"\tpasses: "+Number(this.passes).toFixed(0)+"\tLEV: "+Number(this.lev()).toFixed(0);
  }
}


export class Gcode {
  constructor(le, height = 10, width = 5, padding = 1) {
    this.le = le;
    this.height = height;
    this.width = width;
    this.next_pos = width + padding;

    /*
        coordinates:
        2l -- 2c -- 2r
        1l -- 1c -- 1r
        0l -- 0c -- 0r
    */

    const _0l = [0, 0];
    const _0c = [width / 2, 0];
    const _0r = [width, 0];
    const _0r3 = [width * 2 / 3, 0];
    const _1l = [0, height / 2];
    const _1l3 = [width / 3, height / 2];
    const _1c = [width / 2, height / 2];
    const _1r = [width, height / 2];
    const _1r3 = [width * 2 / 3, height / 2];
    const _2l = [0, height];
    const _2c = [width / 2, height];
    const _2r = [width, height];
    const _2r3 = [width * 2 / 3, height];

    // Define the coordinates for each number
    this.chr_numbers = {
      32: [_0r],  // space
      44: [_0c, [0, height * 1 / 7]],  // ,
      45: [_1l3, _1r3],  // -
      46: [[width * 3 / 7, 0], [width * 4 / 7, 0]],  // .
      48: [_0l, _0r, _2r, _2l, _0l],  // 0
      49: [_0c, _2c],  // 1
      50: [_2l, _2r, _1r, _1l, _0l, _0r],  // 2
      51: [
        _0l,
        _0r,
        [width, height * 2 / 5],
        _1c,
        [width, height * 3 / 5],
        _2r,
        _2l,
      ],  // 3
      52: [_0r3, _2r3, _1l, _1r],  // 4
      53: [_0l, _0r, _1r, _1l, _2l, _2r],  // 5
      54: [_1l, _1r, _0r, _0l, _2l, _2r],  // 6
      55: [_2l, _2r, _0l],  // 7
      56: [_1l, _0l, _0r, _2r, _2l, _1l, _1r],  // 8
      57: [_0l, _0r, _2r, _2l, _1l, _1r],  // 9
      70: [_0l, [0, height * 3 / 7], _1c, [0, height * 4 / 7], _2l, _2r],  // F
      76: [_2l, _0l, _0r],  // L
    };
  }

  write_string(string, x, y) {
    const gcode = [];
    //gcode.push(`; writing string '${string}' @ x: ${x}\ty: ${y}`);
    gcode.push("; writing string "+string+" @ x: "+x+"\ty: "+y);
    for (let c of string) {
      //gcode.push(`; char: '${c}'`);
      gcode.push(": char: '"+c+"'");
      gcode.push(...this.char(c.charCodeAt(0), x, y));
      x += this.next_pos;
    }
    return gcode;
  }

  char(chr_num, x, y) {
    const coords = this.chr_numbers[chr_num];
    const gcode = [];
    //gcode.push(`G0 X${x + coords[0][0]} Y${y + coords[0][1]} S${this.le.map_p()} F${this.le.velocity}`);
    gcode.push("G0 "+"X"+(x + coords[0][0])+ " Y"+(y + coords[0][1])+ " S"+(this.le.map_p())+ " F"+(this.le.velocity));
    for (let i = 1; i < coords.length; i++) {
      //gcode.push(`G1 X${x + coords[i][0]} Y${y + coords[i][1]} S${this.le.map_p()} F${this.le.velocity}`);
      gcode.push("G1 X"+(x + coords[i][0])+ " Y"+(y + coords[i][1])+ " S"+(this.le.map_p())+ " F"+(this.le.velocity));
    }
    return gcode;
  }

  basic_code() {
    return [
      "G00; G17; G40;",
      "G21; G54",
      "G92 X0Y0 (start at current pos)",
      "G90 (absolute coords)",
      "M4 (laser dynamic mode)",
      "G0; X0Y0",
    ];
  }
}

export class Le_field {
  constructor(le_list, rows, columns, row_size, col_size, padding, overscan = 0.1) {
    this.gcode = [];
    this.rows = rows;
    this.columns = columns;
    this.row_size = row_size;
    this.col_size = col_size;
    this.le_list = le_list;
    this.padding = padding;
    this.overscan = overscan;
    this.colwidth = (col_size - (columns - 1) * padding) / columns;
    this.rowheight = (row_size - rows * padding) / (rows + 1); // add a virtual row for the heading later
  }

  make_le_field(lpi = 0) {
    let x = 0, y = 0, col = 0;

    if (lpi < 50 && lpi !== 0) {
      //throw new Error(`LPI of ${lpi} is too small. It should be at least 50!`);
      throw new Error("LPI of "+lpi+" is too small. It should be at least 50!");
    }

    for (let le of this.le_list) {
      //this.gcode.push(`; next LE: ${le.toString()}`);
      this.gcode.push("; next LE: "+le.toString());
      col += 1;
      if (col > this.columns) {
        col = 1;
        x = 0;
        y += this.rowheight + this.padding;
      }
      for (let i = 0; i < le.passes; i++) {
        //this.gcode.push(`; pass ${i + 1}/${le.passes}`);
        //this.gcode.push(`G0 X${x} Y${y}`);
        this.gcode.push("; pass "+(i + 1)+"/"+(le.passes));
        this.gcode.push("G0 X"+x+ " Y"+y);
        if (lpi) {
          // get lines needed for the LPI setting
          const lines = Math.round(lpi * (this.rowheight / 25.4));
          const line_height = this.rowheight / lines;
          for (let p = 0; p < lines; p++) {
            // overscan
            // this.gcode.push(`G0 X${x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan)} Y${y + line_height * p}`);
            // this.gcode.push(`G1 X${x + (this.colwidth || 0)} S0 F${le.velocity}`);
            // this.gcode.push(`G1 X${x + (this.colwidth || 0)} S${map_p(le.power)} F${le.velocity}`);
            // this.gcode.push(`G1 X${x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan)} S0 F${le.velocity}`);
            this.gcode.push("G0 X"+(x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan))+ " Y"+(y + line_height * p));
            this.gcode.push("G1 X"+(x + (this.colwidth || 0))+ " S0 F"+(le.velocity));
            this.gcode.push("G1 X"+(x + (this.colwidth || 0))+ " S"+(map_p(le.power))+ " F"+(le.velocity));
            this.gcode.push("G1 X"+(x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan))+ " S0 F"+(le.velocity));
          
          }
        } else {
          const [power, velocity, _] = le.get();
          // this.gcode.push(`G1 X${x + this.colwidth} Y${y} S${map_p(power)} F${velocity}`);
          // this.gcode.push(`G1 X${x + this.colwidth} Y${y + this.rowheight}`);
          // this.gcode.push(`G1 X${x} Y${y + this.rowheight}`);
          // this.gcode.push(`G1 X${x} Y${y}`);
          this.gcode.push("G1 X"+(x + this.colwidth)+ " Y"+y+ " S"+(map_p(power))+ " F"+(velocity));
          this.gcode.push("G1 X"+(x + this.colwidth)+ " Y"+(y + this.rowheight));
          this.gcode.push("G1 X"+x+ " Y"+(y + this.rowheight));
          this.gcode.push("G1 X"+x+ " Y"+y);
        }
        x += this.colwidth + this.padding;
      }
    }
    return [x - this.padding, y + this.rowheight, this.colwidth, this.rowheight];
  }
}


export class Passes_field {
  constructor(
    base_le,
    rows,
    columns,
    row_size,
    col_size,
    padding,
    passes_factor_int = 1,
    le_variance = 0.05
  ) {
    this.rows = rows;
    this.columns = columns;
    this.row_size = row_size;
    this.col_size = col_size;
    this.base_le = base_le;
    this.padding = padding;
    this.passes_factor_int = passes_factor_int;
    this.le_variance = le_variance;

    // calculations
    this.colwidth = (col_size - (columns - 1) * padding) / columns;
    this.rowheight = (row_size - rows * padding) / (rows + 1);
  }

  make_le_list() {
    // calculate all the necessary LE-values
    const _laser = new Laser();
    const variances = [];

    for (let r = 0; r < this.rows; r++) {
      const is_even = r % 2 === 0;
      const base_lev = this.base_le.lev();
      const new_lev = base_lev * this.le_variance * r * (is_even ? 1 : -1);
      const varValue = _laser.add_le_value(this.base_le, new_lev);
      const index = is_even ? 0 : variances.length;

      variances.splice(index, 0, varValue);

      for (let c = 1; c < this.columns; c++) {
        const newIndex = is_even ? index + 1 : index;
        const newVarValue = _laser.newpass_le_value(varValue, 1, (c + 1) * this.passes_factor_int);
        variances.splice(newIndex, 0, newVarValue);
      }
    }

    return [variances, this.columns * this.passes_factor_int];
  }

  make_pass_field(lpi = 0) {
    let x = 0;
    let y = 0;
    let col = 0;

    if (lpi < 50 && lpi !== 0) {
      //throw new Error(`LPI of ${lpi} is too small. It should be at least 50!`);
      throw new Error("LPI of "+lpi+" is too small. It should be at least 50!");
    }

    const [le_list, max_passes] = this.make_le_list();

    for (const le of le_list) {
      col += 1;
      if (col > this.columns) {
        col = 1;
        x = 0;
        y += this.rowheight + this.padding;
      }
      for (let i = 0; i < le.passes; i++) {
        //this.gcode.push(`G0 X${x} Y${y}`);
        this.gcode.push("G0 X"+x+" Y"+y);
        if (lpi) {
          const lines = Math.round(lpi * (this.rowheight / 25.4));
          const line_height = this.rowheight / lines;
          for (let p = 0; p < lines; p++) {
            this.gcode.push(
              //`G0 X${x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan) * (p % 2 !== 0 ? 1 : -1)} Y${y + line_height * p}`
              "G0 X"+(x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan) * (p % 2 !== 0 ? 1 : -1))+" Y"+(y + line_height * p)
            );
            // this.gcode.push(`G1 X${x + (this.colwidth * (p % 2 !== 0 ? 1 : 0))} S0 F${le.velocity}`);
            // this.gcode.push(`G1 X${x + (this.colwidth * (p % 2 === 0 ? 1 : 0))} S${map_p(le.power)} F${le.velocity}`);
            // this.gcode.push(
            //   `G1 X${x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan) * (p % 2 === 0 ? 1 : -1)} S0 F${le.velocity}`
            // );
            this.gcode.push("G1 X"+(x + (this.colwidth * (p % 2 !== 0 ? 1 : 0)))+" S0 F"+(le.velocity));
            this.gcode.push("G1 X"+(x + (this.colwidth * (p % 2 === 0 ? 1 : 0)))+" S"+(map_p(le.power))+" F"+(le.velocity));
            this.gcode.push(
              "G1 X"+(x + (this.colwidth * (1 + this.overscan) || -this.colwidth * this.overscan) * (p % 2 === 0 ? 1 : -1))+" S0 F"+(le.velocity)
            );
          }
        } else {
          const [power, velocity, _] = le.get();
          // this.gcode.push(`G1 X${x + this.colwidth} Y${y} S${map_p(power)} F${velocity}`);
          // this.gcode.push(`G1 X${x + this.colwidth} Y${y + this.rowheight}`);
          // this.gcode.push(`G1 X${x} Y${y + this.rowheight}`);
          // this.gcode.push(`G1 X${x} Y${y}`);
          this.gcode.push("G1 X"+(x + this.colwidth)+" Y"+y+" S"+(map_p(power))+" F"+(velocity));
          this.gcode.push("G1 X"+(x + this.colwidth)+" Y"+(y + this.rowheight));
          this.gcode.push("G1 X"+x+" Y"+(y + this.rowheight));
          this.gcode.push("G1 X"+x+" Y"+y);
        }
        x += this.colwidth + this.padding;
      }
    }

    return [x - this.padding, y + this.rowheight, this.colwidth, this.rowheight, max_passes];
  }
}