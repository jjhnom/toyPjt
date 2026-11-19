import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDevices,selectDevice} from '../scripts/android-device-check.mjs';

test('ADB parsing distinguishes ready, offline and unauthorized devices',()=>{
 const devices=parseDevices('* daemon started successfully\r\nList of devices attached\r\nusb123\tdevice product:test model:Phone\r\nusb456\tunauthorized\r\nemulator-5554 offline\r\n');
 assert.equal(devices.length,3);assert.equal(devices[0].details,'product:test model:Phone');
 assert.equal(selectDevice(devices).serial,'usb123');
 assert.throws(()=>selectDevice(devices,'usb456'),/승인/);
 assert.throws(()=>selectDevice(devices,'emulator-5554'),/승인/);
});
test('missing and multiple devices cannot silently select an installation target',()=>{
 assert.throws(()=>selectDevice(parseDevices('List of devices attached\n')),/기기가 없습니다/);
 const devices=parseDevices('first device\nsecond device');
 assert.throws(()=>selectDevice(devices),/--serial/);
 assert.equal(selectDevice(devices,'second').serial,'second');
 assert.throws(()=>selectDevice(devices,'missing'),/지정 기기/);
});
