import struct, subprocess, sys, os, tempfile

def crop(src, dst, x, y, w, h):
    tmp = tempfile.mkdtemp()
    bmp = os.path.join(tmp, 'a.bmp'); out = os.path.join(tmp, 'b.bmp')
    subprocess.run(['sips','-s','format','bmp',src,'--out',bmp], check=True, capture_output=True)
    raw = open(bmp,'rb').read()
    off = struct.unpack_from('<I', raw, 10)[0]
    W, HS = struct.unpack_from('<ii', raw, 18)
    bpp = struct.unpack_from('<H', raw, 28)[0]
    topdown = HS < 0; H = abs(HS)
    rowb = ((bpp*W + 31)//32)*4
    px = bpp//8
    x = max(0,min(x,W-1)); y = max(0,min(y,H-1))
    w = min(w, W-x); h = min(h, H-y)
    rows = []
    for j in range(h):
        sy = y + j if topdown else (H - 1 - (y + j))
        s = off + sy*rowb + x*px
        row = raw[s:s+w*px]
        pad = (-(w*px)) % 4
        rows.append(row + b'\0'*pad)
    body = b''.join(rows) if topdown else b''.join(reversed(rows))
    hdr = bytearray(raw[:off])
    struct.pack_into('<i', hdr, 18, w)
    struct.pack_into('<i', hdr, 22, -h if topdown else h)
    struct.pack_into('<I', hdr, 2, len(hdr)+len(body))
    struct.pack_into('<I', hdr, 34, len(body))
    open(out,'wb').write(bytes(hdr)+body)
    subprocess.run(['sips','-s','format','png',out,'--out',dst], check=True, capture_output=True)
    print('%-34s %4dx%-4d -> %s' % (os.path.basename(src), w, h, dst))

if __name__ == '__main__':
    a = sys.argv[1:]
    crop(a[0], a[1], *map(int, a[2:6]))
