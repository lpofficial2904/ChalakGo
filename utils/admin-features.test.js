import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Credentials from '../models/AdminCredentials.js';
import Booking from '../models/Booking.js';
import Contact from '../models/ContactMessage.js';
import User from '../models/User.js';
import authRoutes from '../routes/auth.js';
import bookingRoutes from '../routes/bookings.js';
import contactRoutes from '../routes/contacts.js';
import userRoutes from '../routes/users.js';
import { apiErrorHandler } from './router.js';

test('admin credential rotation and delete endpoints enforce authentication', async () => {
  const previousState=mongoose.connection.readyState;
  const previousEnv={ADMIN_USERNAME:process.env.ADMIN_USERNAME,ADMIN_PASSWORD:process.env.ADMIN_PASSWORD,JWT_SECRET:process.env.JWT_SECRET};
  process.env.ADMIN_USERNAME='test-admin';process.env.ADMIN_PASSWORD='test-current-password';process.env.JWT_SECRET='test-only-secret';
  mongoose.connection.readyState=1;
  let credentials=null;
  const originals=[];
  const stub=(object,key,value)=>{originals.push(()=>object[key]=object[key]);const old=object[key]; originals[originals.length-1]=()=>object[key]=old;object[key]=value;};
  stub(Credentials,'findById',()=>Object.assign(Promise.resolve(credentials),{select:()=>Promise.resolve(credentials)}));
  stub(Credentials,'findOneAndUpdate',async (_filter,update)=>credentials={_id:'primary',...update.$set});
  for(const Model of [Booking,Contact,User]) {let exists=true;stub(Model,'findByIdAndDelete',async()=>{if(!exists)return null;exists=false;return {_id:'a'.repeat(24)};});}
  const app=express();app.use(express.json());app.use('/api/auth',authRoutes);app.use('/api/bookings',bookingRoutes);app.use('/api/contacts',contactRoutes);app.use('/api/users',userRoutes);app.use(apiErrorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const call=(path,method,token,body)=>fetch(`http://127.0.0.1:${server.address().port}/api/${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  try {
    const old=jwt.sign({username:'test-admin',role:'admin'},process.env.JWT_SECRET,{expiresIn:'1h'});
    const ordinary=jwt.sign({role:'user'},process.env.JWT_SECRET,{expiresIn:'1h'});
    for(const type of ['bookings','contacts','users']) {
      assert.equal((await call(`${type}/admin/${'a'.repeat(24)}`,'DELETE')).status,401);
      assert.equal((await call(`${type}/admin/${'a'.repeat(24)}`,'DELETE',ordinary)).status,403);
    }
    assert.equal((await call('auth/credentials','PUT',old,{username:'updated',currentPassword:'wrong',newPassword:'new-password-123'})).status,401);
    assert.equal(credentials,null);
    const rotated=await call('auth/credentials','PUT',old,{username:'updated',currentPassword:'test-current-password',newPassword:'new-password-123'});
    assert.equal(rotated.status,200);const data=await rotated.json();assert.ok(data.token);assert.ok(await bcrypt.compare('new-password-123',credentials.passwordHash));assert.notEqual(credentials.passwordHash,'new-password-123');
    assert.equal((await call('auth/me','GET',old)).status,401);
    assert.equal((await call('auth/login','POST',null,{username:'test-admin',password:'test-current-password'})).status,401);
    assert.equal((await call('auth/login','POST',null,{username:'updated',password:'new-password-123'})).status,200);
    for(const type of ['bookings','contacts','users']) {
      assert.equal((await call(`${type}/admin/bad-id`,'DELETE',data.token)).status,400);
      assert.equal((await call(`${type}/admin/${'a'.repeat(24)}`,'DELETE',data.token)).status,204);
      assert.equal((await call(`${type}/admin/${'a'.repeat(24)}`,'DELETE',data.token)).status,404);
    }
  } finally {await new Promise(resolve=>server.close(resolve));originals.reverse().forEach(restore=>restore());mongoose.connection.readyState=previousState;for(const [key,value] of Object.entries(previousEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
