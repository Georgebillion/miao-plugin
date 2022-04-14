import fs from "fs";
import fetch from "node-fetch";
import lodash from "lodash";

const _path = process.cwd();
const cfgPath = `${_path}/plugins/miao-plugin/components/setting.json`;
let cfg = {};
try {
  if (fs.existsSync(cfgPath)) {
    cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")) || {};
  }
} catch (e) {
  // do nth
}

const userPath = `${_path}/data/UserData/`;

if (!fs.existsSync(userPath)) {
  fs.mkdirSync(userPath);
}

const artifactMap = {
  '生命值': {
    title: "小生命"
  },
  '生命值_百分比': {
    title: "大生命",
    pct: true
  },
  '暴击率': {
    title: "暴击率",
    pct: true
  },
  '暴击伤害': {
    title: "爆伤",
    pct: true
  },
  '防御力': {
    title: "小防御"
  },
  '防御力_百分比': {
    title: "大防御",
    pct: true
  },
  '攻击力': {
    title: "小攻击"
  },
  '攻击力_百分比': {
    title: "大攻击",
    pct: true
  },
  '元素精通': {
    title: "精通"
  },
  '元素充能效率': {
    title: "充能",
    pct: true
  },
  '治疗加成': {
    title: "治疗",
    pct: true
  }
}

let Data = {
  getData(uid, data) {
    let ret = {
      uid,
      chars: {}
    };

    lodash.forEach({
      name: "角色名称",
      avatar: "头像ID",
      lv: "冒险等阶"
    }, (title, key) => {
      ret[key] = data[title] || "";
    })

    lodash.forEach(data.items, (ds) => {
      let char = Data.getAvatar(ds);
      ret.chars[char.id] = char;
    });

    return ret;

  },
  getAvatar(data) {
    return {
      id: data["英雄Id"],
      lv: data['等级'],
      attr: Data.getAttr(data),
      weapon: Data.getWeapon(data),
      artis: Data.getArtifact(data),
      cons: data["命之座数量"] * 1 || 0,
      talent: Data.getTalent(data)
    };
  },
  getAttr(data) {
    let ret = {};
    let attrKey = {
      atk: "攻击力_总",
      atkBase: "属性攻击力",
      def: "防御力_总",
      defBase: "属性防御力",
      hp: "生命值上限_总",
      hpBase: "属性生命值上限",
      mastery: "属性元素精通",
      cRate: {
        title: "属性暴击率",
        pct: true
      },
      cDmg: {
        title: "属性暴击伤害",
        pct: true
      },
      hInc: {
        title: "属性治疗加成",
        pct: true
      },
      recharge: {
        title: "属性元素充能效率",
        pct: true
      }
    };
    lodash.forEach(attrKey, (cfg, key) => {
      if (typeof (cfg) === "string") {
        cfg = { title: cfg };
      }
      let val = data[cfg.title] || "";
      if (cfg.pct) {
        val = (val * 100).toFixed(2)
      }
      ret[key] = val;
    });
    let maxDmg = 0;
    lodash.forEach("火水草雷风冰岩".split(""), (key) => {
      maxDmg = Math.max(data[`属性${key}元素伤害加成`] * 1, maxDmg);
    });
    ret.dmgBonus = (maxDmg * 100).toFixed(2);

    return ret;
  },
  getWeapon(data) {
    return {
      name: data['武器名称'],
      lv: data['武器等级'],
      refine: data["武器精炼"]
    }
  },
  getArtifact(data) {
    let ret = {};
    let get = function (idx, key) {
      let v = data[`圣遗物${idx}${key}`];
      let ret = /^([^\d]*)([\d\.\-]*)$/.exec(v);
      if (ret && ret[1]) {
        let title = ret[1], val = ret[2];
        if (artifactMap[title]) {
          if (artifactMap[title].pct) {
            val = (val * 100).toFixed(2);
          }
          title = artifactMap[title].title;
        }
        return [title, val];
      }
      return [];
    }

    for (let idx = 1; idx <= 5; idx++) {
      ret[`arti${idx}`] = {
        name: data[`圣遗物${idx}名称`],
        type: data[`圣遗物${idx}类型`],
        main: get(idx, "主词条"),
        attrs: [
          get(idx, "副词条1"),
          get(idx, "副词条2"),
          get(idx, "副词条3"),
          get(idx, "副词条4"),
        ]
      };
    }
    return ret;
  },
  getTalent(data) {
    let ret = {};
    lodash.forEach({
      a: 1,
      e: 2,
      q: 3
    }, (idx, key) => {
      let val = data[`天赋主动名称${idx}`]
      let regRet = /等级(\d*)$/.exec(val);
      if (regRet && regRet[1]) {
        ret[key] = regRet[1] * 1 || 1
      } else {
        ret[key] = 1;
      }
    })
    return ret;
  }
}

let Profile = {
  async request(uid) {
    if (!cfg.api) {
      return {};
    }
    const api = cfg.api + uid;
    let req = await fetch(api);
    let data = await req.text();
    data = data.replace(/\x00/g, '');
    fs.writeFileSync(userPath + "/test.json", data);
    data = JSON.parse(data);
    let userData = {};
    if (data && data["角色名称"]) {
      userData = Profile.save(uid, data)
    }
    return userData;
  },

  save(uid, ds) {
    let userData = {};
    const userFile = `${userPath}/${uid}.json`;
    if (fs.existsSync(userFile)) {
      userData = JSON.parse(fs.readFileSync(userFile, "utf8")) || {};
    }

    let data = Data.getData(uid, ds);

    lodash.assignIn(userData, lodash.pick(data, "uid,name,lv,avatar".split(",")));

    userData.chars = userData.chars || {};
    lodash.forEach(data.chars, (char, charId) => {
      userData.chars[charId] = char;
    });

    fs.writeFileSync(userFile, JSON.stringify(userData), "", " ");
    return userData;
  },
  get(uid, charId) {
    const userFile = `${userPath}/${uid}.json`;
    let userData = {};
    if (fs.existsSync(userFile)) {
      userData = JSON.parse(fs.readFileSync(userFile, "utf8")) || {};
    }
    if (userData && userData.chars && userData.chars[charId]) {
      return userData.chars[charId];
    }
    return false;
  }
};
export default Profile;
