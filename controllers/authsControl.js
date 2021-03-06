const jwt = require('jsonwebtoken')
const passport = require('../middlewares/passport');
const config = require('../config')
const User = require('../schemas/user')

function tokenForUser(user) {
  const timestamp = new Date().getTime();
  // Signing a token with 1 hour of expiration:
  const token = jwt.sign({ user: {id: user.id, name: user.nikename}, iat: timestamp }, config.secret, { expiresIn: '1h' })
  return token
}

// 注册
exports.SignUp = async(ctx, next) => {
    const { email, password, repassword, nikename } = ctx.request.body;
   
    // check params
    if(!email || !password || !repassword) {
      ctx.body = {
        code: 422,
        message: 'You must provide email & password'
      };
      return
    } else if (password !== repassword) { 
      ctx.body = {
        code: 422,
        message: 'password are not the same! Please check'
      };
      return
    }

    const existingUser = await User.findOne({ email }).exec()
    if (existingUser) {
      ctx.body = {
        code: 422,
        message: 'Email is in use'
      };
      return
    }
  
    const user = new User({
        email, 
        password, 
        type: 'local', 
        nikename: nikename || email.substr(0, email.indexOf('@')) 
    })
    await user.save()

    ctx.body = {
      token: tokenForUser(user), 
      user: { id: user.id, name: user.nikename }
    }
}

// 登录
exports.Login = async (ctx, next) => {
  return passport.authenticate('local', (err, user, info, status) => {
    // User has already had their email and password auth'd
    // just need to give them a token
    if (!user) {
      ctx.body = {
        code: 200,
        message: info.message
      }
    } else {
      ctx.body = {
        token: tokenForUser(user),
        user: { id: user.id, name: user.nikename }
      }
    }
  })(ctx, next)
}

// 验证token
exports.Verify = async (ctx, next) => {
  return passport.authenticate('jwt', (err, user, info, status) => {
    if (!user) {
      ctx.body = {
        code: 401,
        message: info.message
      }
    } else {
      next()
    }
  })(ctx, next)
}

/** update password */
// params: id, originpwd, newpwd, checkpwd
exports.UpdatePassword = async (ctx, next) => {
  const { id, originpwd, newpwd, checkpwd } = ctx.request.body
  if (!id || !originpwd || !newpwd) {
    ctx.body = {
      code: 400,
      messages: 'You must provide old password & new password and userID'
    }
    return;
  } else if (newpwd === originpwd) {
    ctx.body = {
      code: 200,
      messages: 'The new password and the older password are the same!'
    }
    return;
  } else if (newpwd !== checkpwd) {
    ctx.body = {
      code: 200,
      messages: 'The new password and the check password are not same!'
    }
    return;
  }

  const user = await User.findOne({_id: id});
  if (!user) {
    ctx.body = {
      code: 200,
      message: 'The user is not exist !'
    }
    return;
  }

  await user.validPassword(originpwd, (err, isAuthorize) => {
    if (err) return err
    if (isAuthorize) {
      user.password = newpwd
      user.save()
    } else {
      ctx.body = {
        code: 200,
        messages: 'The origin password is not correct!'
      }
    }
  })
}