from pathlib import Path
import pickle
import json

repeats = {
    "configs/lin-wang-coy-2021/reg_96_97/config.json": {
      "PanCK": ["Tissue Structure", "Proliferation", "PD1 Immune Checkpoint", "NaK ATPase", "E-Cadherin", "Tumor Budding Epithelial", "Tumor Budding Immune Modulation", "Transitions"],
      "ASMA": ["Tissue Structure", "Stroma"],
      "CD45": ["Tissue Structure", "Immune Populations", "Proliferation"],
      "CD8a": ["Immune Populations", "Lymphocytes", "CD8 Cytotoxic T Cells", "FOXP3 CD8 T Cells", "PDL1-CD8 Interaction", "Tumor Budding Immune Modulation"],
      "CD4": ["Immune Populations", "Lymphocytes", "Helper and Regulatory T Cells", "PDL1-Positive Immune Cells"],
      "CD20": ["Immune Populations", "Lymphocytes"],
      "CD68": ["Immune Populations", "Macrophages", "PDL1-Positive Immune Cells", "Tumor Budding Immune Modulation"],
      "CD163": ["Immune Populations", "Macrophages", "PDL1-Positive Immune Cells"],
      "FOXP3": ["Lymphocytes", "Helper and Regulatory T Cells", "FOXP3 CD8 T Cells", "Tumor Budding Immune Modulation"],
      "PCNA": ["Proliferation", "Tumor Budding Epithelial", "Transitions"],
      "PDL1": ["PD1 Immune Checkpoint", "PDL1-Positive Immune Cells", "PDL1-CD8 Interaction", "Tumor Budding Immune Modulation"],
      "PD1": ["PD1 Immune Checkpoint", "CD8 Cytotoxic T Cells", "PDL1-CD8 Interaction", "Tumor Budding Immune Modulation"],
      "Ecadherin": ["E-Cadherin", "Tumor Budding Epithelial", "Transitions"]
    },
    "configs/gaglia-PCQ-2020/0813/config.json": {
        "e-Cadherin": ["Cell Type", "Proliferation", "Arrest", "Proliferation and Arrest", "Cell Cycle", "e-Cadherin"],
        "CD45": ["Cell Type", "CD45"],
        "Vimentin": ["Cell Type", "Vimentin"],
        "aSMA": ["Cell Type", "aSMA"],
        "PCNA": ["Proliferation", "Proliferation and Arrest", "PCNA"],
        "MCM2": ["Proliferation", "Proliferation and Arrest", "MCM2"],
        "Ki67": ["Proliferation", "Proliferation and Arrest", "Ki67 - Cell Signaling Technology AF488", "Ki67 - Biolegend AF555"],
        "p21": ["Arrest", "Proliferation and Arrest", "p21"],
        "p27": ["Arrest", "Proliferation and Arrest", "p27"],
        "CDT1": ["Cell Cycle", "CDT1"],
        "CCNE1": ["Cell Cycle", "Cyclin E1"],
        "Geminin": ["Cell Cycle", "Geminin"],
        "pRB": ["Cell Cycle", "pRB"],
        "pHH3": ["Cell Cycle", "pHH3"]
    },
    "configs/duraiswamy-2020/C0138/config.dat": {
        "CD11c": ["T-cell-myeloid interactions", "Myeloid cells"],
        "CD8a": ["T-cell-myeloid interactions", "T-cells"],
        "CD163": ["T-cell-myeloid interactions", "Myeloid cells"],
        "FOXP3": ["T-cell-myeloid interactions", "T-cells"],
        "PD1": ["T-cell-myeloid interactions", "Functional markers"]
    },
    "configs/duraiswamy-2020/C0156/config.dat": {
        "PD1": ["Functional Markers", "T-cell-myeloid interaction"],
        "pSTAT1": ["Functional Markers", "T-cell-myeloid interaction"],
        "CK7": ["Tumor-stroma", "T-cell-myeloid interaction"],
        "CD8a": ["T-cells", "T-cell-myeloid interaction"],
        "CD11c": ["Myeloid cells", "T-cell-myeloid interaction"]
    }
}

def path_to_name(fpath, gpath):
    story_map = {
        "configs/lin-wang-coy-2021/reg_96_97/config.json": "configs/lin-wang-coy-2021/reg_96_97/exhibit.json"
    }
    spath = story_map[fpath]
    with open(spath, "r") as fp:
        story = json.load(fp)
        paths = [g["Path"] for g in story["Groups"]]
        names = [g["Name"] for g in story["Groups"]]
        pdict = {p: n for p,n in zip(paths, names)}
        return pdict[gpath]
    return ""

def num_to_name(fpath, num):
    story_map = {
        "configs/gaglia-PCQ-2020/0813/config.json": "configs/gaglia-PCQ-2020/0813/exhibit.json",
        "configs/lin-wang-coy-2021/reg_96_97/config.json": "configs/lin-wang-coy-2021/reg_96_97/exhibit.json"
    }
    if not fpath in story_map:
        return num
    spath = story_map[fpath]
    with open(spath, "r") as fp:
        story = json.load(fp)
        paths = [g["Path"] for g in story["Groups"]]
        cdict = {}
        for path in paths:
            for cpath in path.split('_',1)[1].split("--"):
                try:
                    [n, name] = cpath.split('__')
                    cdict[n] = name
                except:
                    continue
        return cdict.get(str(num), str(num))
    return str(num)

def to_chans(fpath, group):
    if "Group Path" in group:
        lows = group["Low"]
        highs = group["High"]
        gpath = group["Group Path"]
        nums = group["Channel Number"]
        chans = zip(nums, highs, lows)
        for [num, high, low] in chans:
            name = num
            yield {
                "Group": path_to_name(fpath, gpath),
                "Name": name,
                "Number": num,
                "High": high,
                "Low": low 
            }
    else:
        low = group["Low"]
        high = group["High"]
        num = group["Channel Number"]
        name = num 
        yield {
            "Group": group["Group"],
            "Name": name,
            "Number": num,
            "High": high,
            "Low": low 
        }

def read_json(fpath, groups):
    for group in groups:
        for chan in to_chans(fpath, group):
            yield chan

def read_dat(groups):
    for group in groups:
        for chan in group["channels"]:
            yield {
                "Number": chan["id"],
                "Group": group["label"],
                "Name": chan["label"],
                "High": round(chan["max"] * 65535),
                "Low": round(chan["min"] * 65535)
            }

if __name__ == "__main__":

    for fpath in repeats.keys():
        ext = Path(fpath).suffix[1:]
        saved = None
        if ext == "dat":
            groups = pickle.load( open( fpath, "rb" ) )["groups"]
            saved = list(read_dat(groups))
        else:
            with open(fpath, "r") as fp:
                saved = list(read_json(fpath, json.load(fp)))
        odict = {}
        ndict = {}
        for chan in saved:
            ndict[chan['Name']] = chan['Number']
            oset = odict.get(chan['Name'], set())
            oset.add(f'[{chan["Low"]}, {chan["High"]}]')
            odict[chan['Name']] = oset

        print(fpath)
        for chan, ranges in odict.items():
            if (len(ranges) > 1):
                cnum = str(ndict[chan])
                cname = num_to_name(fpath, chan)
                print('#'+cnum, '"'+cname+'"\n', ', '.join(ranges))
